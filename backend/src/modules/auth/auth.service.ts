import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, withTransaction } from '../../database/pool';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { JwtPayload } from '../../middleware/authenticate';

const BCRYPT_ROUNDS = 12;

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  is_active: boolean;
  failed_attempts: number;
  locked_until: Date | null;
  last_login: Date | null;
  roles: string[];
  enumerator_id: string | null;
}

interface LoginResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    username: string;
    fullName: string;
    roles: string[];
    enumeratorId: string | null;
  };
  message?: string;
  code?: string;
}

/**
 * Servicio de autenticación.
 * Gestiona login, tokens JWT y refresh tokens.
 */
export class AuthService {
  /**
   * Intenta autenticar a un usuario con username/email y contraseña.
   * Verifica las credenciales y genera tokens para una sesión válida.
   */
  async login(identifier: string, password: string): Promise<LoginResult> {
    // Buscar usuario por username o email
    const result = await query<UserRow>(
      `SELECT
        u.id, u.username, u.email, u.password_hash, u.full_name,
        u.is_active, u.failed_attempts, u.locked_until, u.last_login,
        ARRAY_AGG(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
        e.id AS enumerator_id
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN enumerators e ON e.user_id = u.id
      WHERE (LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1))
      GROUP BY u.id, e.id`,
      [identifier]
    );

    if (result.rowCount === 0) {
      // No revelar si el usuario existe o no (previene enumeración)
      await this.simulateHashCheck(); // Timing-safe: evita timing attacks
      return {
        success: false,
        message: 'Credenciales incorrectas.',
        code: 'INVALID_CREDENTIALS',
      };
    }

    const user = result.rows[0];

    // Verificar si la cuenta está desactivada
    if (!user.is_active) {
      return {
        success: false,
        message: 'Esta cuenta está desactivada. Contacta al administrador.',
        code: 'ACCOUNT_DISABLED',
      };
    }

    // Verificar contraseña
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return {
        success: false,
        message: 'Credenciales incorrectas.',
        code: 'INVALID_CREDENTIALS',
      };
    }

    // Login exitoso: resetear contador de intentos
    await query(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Generar tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    logger.info('Login exitoso', { userId: user.id, username: user.username });

    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        roles: user.roles ?? [],
        enumeratorId: user.enumerator_id,
      },
    };
  }

  /**
   * Renueva el access token usando un refresh token válido.
   */
  async refreshAccessToken(refreshToken: string): Promise<LoginResult> {
    const tokenHash = this.hashToken(refreshToken);

    const result = await query<{ user_id: string; expires_at: Date; revoked_at: Date | null }>(
      `SELECT user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return { success: false, message: 'Token inválido.', code: 'TOKEN_INVALID' };
    }

    const tokenRow = result.rows[0];

    if (tokenRow.revoked_at) {
      logger.warn('Intento de uso de refresh token revocado', { tokenHash: tokenHash.slice(0, 8) });
      return { success: false, message: 'Token revocado.', code: 'TOKEN_REVOKED' };
    }

    if (new Date() > new Date(tokenRow.expires_at)) {
      return { success: false, message: 'Sesión expirada. Por favor inicia sesión nuevamente.', code: 'TOKEN_EXPIRED' };
    }

    // Obtener datos del usuario
    const userResult = await query<UserRow>(
      `SELECT u.id, u.username, u.email, u.full_name, u.is_active,
              0 AS failed_attempts, NULL AS locked_until, NULL AS last_login,
              ARRAY_AGG(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
              e.id AS enumerator_id
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN enumerators e ON e.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id, e.id`,
      [tokenRow.user_id]
    );

    if (userResult.rowCount === 0 || !userResult.rows[0].is_active) {
      return { success: false, message: 'Usuario no disponible.', code: 'USER_UNAVAILABLE' };
    }

    const user = userResult.rows[0];

    // Rotación del refresh token: revocar el actual y generar uno nuevo
    const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(user, tokenHash);

    return {
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        roles: user.roles ?? [],
        enumeratorId: user.enumerator_id,
      },
    };
  }

  /**
   * Revoca todos los refresh tokens del usuario (logout).
   */
  async logout(userId: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    logger.info('Logout: refresh tokens revocados', { userId });
  }

  /**
   * Hashea una contraseña con bcrypt.
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  // ── Métodos privados ──────────────────────────────────────

  private async generateTokens(
    user: UserRow,
    revokeTokenHash?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      fullName: user.full_name,
      roles: user.roles ?? [],
      enumeratorId: user.enumerator_id ?? undefined,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: Math.ceil(this.parseDuration(env.JWT_ACCESS_EXPIRY) / 1000),
      issuer: 'encuestaapp',
    });

    // Generar refresh token seguro
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    await withTransaction(async (client) => {
      // Revocar token anterior si se está rotando
      if (revokeTokenHash) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
          [revokeTokenHash]
        );
      }

      // Guardar nuevo refresh token (hash, nunca el token en claro)
      const expiresAt = new Date(
        Date.now() + this.parseDuration(env.JWT_REFRESH_EXPIRY)
      );

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Simula el tiempo de un bcrypt.compare para prevenir timing attacks */
  private async simulateHashCheck(): Promise<void> {
    const dummy = '$2b$12$invalidhashtopreventtimingattacks.invalidhash.invalid';
    await bcrypt.compare('dummy', dummy).catch(() => {});
  }

  private parseDuration(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      throw new Error(`Formato de duración JWT inválido: ${duration}`);
    }
    const [, num, unit] = match;
    const n = parseInt(num);
    const multipliers: Record<string, number> = {
      s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000,
    };
    return n * (multipliers[unit] ?? 86_400_000);
  }
}

export const authService = new AuthService();
