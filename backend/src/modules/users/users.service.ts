import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { authService } from '../auth/auth.service';
import { query, withTransaction } from '../../database/pool';
import type { CreateUserInput, UpdateUserInput } from './users.validators';

export interface UserRecord {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: 'ADMIN' | 'SUPERVISOR' | 'ENUMERATOR';
  isActive: boolean;
  createdAt: string;
}

interface UserRow {
  id: string;
  username: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRecord['role'];
  is_active: boolean;
  created_at: Date;
}

const USER_SELECT = `SELECT u.id, u.username, u.full_name, u.email, u.phone,
                            r.name AS role, u.is_active, u.created_at
                     FROM users u
                     JOIN user_roles ur ON ur.user_id = u.id
                     JOIN roles r ON r.id = ur.role_id`;

function newEnumeratorCode(): string {
  return `ENC-${randomUUID().replaceAll('-', '').slice(0, 15)}`;
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString().slice(0, 10),
  };
}

function toDatabaseRole(role: UpdateUserInput['role']): UserRecord['role'] {
  return role;
}

export class UsersService {
  async list(): Promise<UserRecord[]> {
    const result = await query<UserRow>(`${USER_SELECT} ORDER BY u.created_at DESC, u.username`);
    return result.rows.map(toUserRecord);
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const passwordHash = await authService.hashPassword(input.password);
    return withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO users (username, email, password_hash, full_name, phone)
         VALUES ($1, LOWER($2), $3, $4, NULLIF($5, ''))
         RETURNING id`,
        [input.username, input.email, passwordHash, input.fullName, input.phone]
      );
      const userId = inserted.rows[0].id;

      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = $2`,
        [userId, input.role]
      );

      if (input.role === 'ENUMERATOR') {
        await client.query(
          `INSERT INTO enumerators (user_id, code, full_name, phone)
           VALUES ($1, $2, $3, NULLIF($4, ''))`,
          [userId, newEnumeratorCode(), input.fullName, input.phone]
        );
      }

      const result = await client.query<UserRow>(
        `${USER_SELECT} WHERE u.id = $1`,
        [userId]
      );
      return toUserRecord(result.rows[0]);
    });
  }

  async update(userId: string, input: UpdateUserInput): Promise<UserRecord | null> {
    const passwordHash = input.password
      ? await authService.hashPassword(input.password)
      : undefined;

    return withTransaction(async (client) => {
      const existing = await client.query<{ id: string; is_active: boolean }>(
        `SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (!existing.rowCount) return null;

      await this.ensureActiveAdminRemains(
        client,
        userId,
        existing.rows[0].is_active && input.role === 'ADMIN'
      );

      await client.query(
        `UPDATE users
         SET full_name = $1, email = LOWER($2), phone = NULLIF($3, '')
         WHERE id = $4`,
        [input.fullName, input.email, input.phone, userId]
      );
      await client.query(
        `UPDATE user_roles
         SET role_id = (SELECT id FROM roles WHERE name = $1)
         WHERE user_id = $2`,
        [toDatabaseRole(input.role), userId]
      );
      if (passwordHash) {
        await client.query(
          `UPDATE users
           SET password_hash = $1, failed_attempts = 0, locked_until = NULL
           WHERE id = $2`,
          [passwordHash, userId]
        );
        await client.query(
          `UPDATE refresh_tokens
           SET revoked_at = NOW()
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId]
        );
      }

      const enumerator = await client.query<{ id: string }>(
        `SELECT id FROM enumerators WHERE user_id = $1`,
        [userId]
      );
      if (enumerator.rowCount) {
        await client.query(
          `UPDATE enumerators
           SET full_name = $1, phone = NULLIF($2, ''), is_active = $3
           WHERE user_id = $4`,
          [input.fullName, input.phone, existing.rows[0].is_active && input.role === 'ENUMERATOR', userId]
        );
      } else if (input.role === 'ENUMERATOR') {
        await client.query(
          `INSERT INTO enumerators (user_id, code, full_name, phone)
           VALUES ($1, $2, $3, NULLIF($4, ''))`,
          [userId, newEnumeratorCode(), input.fullName, input.phone]
        );
      }

      const result = await client.query<UserRow>(
        `${USER_SELECT} WHERE u.id = $1`,
        [userId]
      );
      return toUserRecord(result.rows[0]);
    });
  }

  async deactivate(userId: string): Promise<UserRecord | null> {
    return withTransaction(async (client) => {
      const existing = await client.query<{ id: string; is_active: boolean }>(
        `SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (!existing.rowCount) return null;
      await this.ensureActiveAdminRemains(client, userId, false);

      await client.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [userId]);
      await client.query(
        `UPDATE enumerators SET is_active = FALSE WHERE user_id = $1`,
        [userId]
      );
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
      );

      const result = await client.query<UserRow>(
        `${USER_SELECT} WHERE u.id = $1`,
        [userId]
      );
      return toUserRecord(result.rows[0]);
    });
  }

  async activate(userId: string): Promise<UserRecord | null> {
    return withTransaction(async (client) => {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (!existing.rowCount) return null;

      await client.query(
        `UPDATE users SET is_active = TRUE, failed_attempts = 0, locked_until = NULL WHERE id = $1`,
        [userId]
      );
      await client.query(
        `UPDATE enumerators e
         SET is_active = EXISTS (
           SELECT 1
           FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = e.user_id AND r.name = 'ENUMERATOR'
         )
         WHERE e.user_id = $1`,
        [userId]
      );

      const result = await client.query<UserRow>(
        `${USER_SELECT} WHERE u.id = $1`,
        [userId]
      );
      return toUserRecord(result.rows[0]);
    });
  }

  private async ensureActiveAdminRemains(
    client: PoolClient,
    userId: string,
    willRemainAdmin: boolean
  ): Promise<void> {
    if (willRemainAdmin) return;

    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.is_active = TRUE AND r.name = 'ADMIN' AND u.id <> $1`,
      [userId]
    );
    if (Number(result.rows[0].count) === 0) {
      throw new Error('Debe permanecer al menos un administrador activo.');
    }
  }
}

export const usersService = new UsersService();
