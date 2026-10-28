"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersService = exports.UsersService = void 0;
const crypto_1 = require("crypto");
const auth_service_1 = require("../auth/auth.service");
const pool_1 = require("../../database/pool");
const USER_SELECT = `SELECT u.id, u.username, u.full_name, u.email, u.phone,
                            r.name AS role, u.is_active, u.created_at
                     FROM users u
                     JOIN user_roles ur ON ur.user_id = u.id
                     JOIN roles r ON r.id = ur.role_id`;
function newEnumeratorCode() {
    return `ENC-${(0, crypto_1.randomUUID)().replaceAll('-', '').slice(0, 15)}`;
}
function toUserRecord(row) {
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
function toDatabaseRole(role) {
    return role;
}
class UsersService {
    async list() {
        const result = await (0, pool_1.query)(`${USER_SELECT} ORDER BY u.created_at DESC, u.username`);
        return result.rows.map(toUserRecord);
    }
    async create(input) {
        const passwordHash = await auth_service_1.authService.hashPassword(input.password);
        return (0, pool_1.withTransaction)(async (client) => {
            const inserted = await client.query(`INSERT INTO users (username, email, password_hash, full_name, phone)
         VALUES ($1, LOWER($2), $3, $4, NULLIF($5, ''))
         RETURNING id`, [input.username, input.email, passwordHash, input.fullName, input.phone]);
            const userId = inserted.rows[0].id;
            await client.query(`INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = $2`, [userId, input.role]);
            if (input.role === 'ENUMERATOR') {
                await client.query(`INSERT INTO enumerators (user_id, code, full_name, phone)
           VALUES ($1, $2, $3, NULLIF($4, ''))`, [userId, newEnumeratorCode(), input.fullName, input.phone]);
            }
            const result = await client.query(`${USER_SELECT} WHERE u.id = $1`, [userId]);
            return toUserRecord(result.rows[0]);
        });
    }
    async update(userId, input) {
        const passwordHash = input.password
            ? await auth_service_1.authService.hashPassword(input.password)
            : undefined;
        return (0, pool_1.withTransaction)(async (client) => {
            const existing = await client.query(`SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE`, [userId]);
            if (!existing.rowCount)
                return null;
            await this.ensureActiveAdminRemains(client, userId, existing.rows[0].is_active && input.role === 'ADMIN');
            await client.query(`UPDATE users
         SET full_name = $1, email = LOWER($2), phone = NULLIF($3, '')
         WHERE id = $4`, [input.fullName, input.email, input.phone, userId]);
            await client.query(`UPDATE user_roles
         SET role_id = (SELECT id FROM roles WHERE name = $1)
         WHERE user_id = $2`, [toDatabaseRole(input.role), userId]);
            if (passwordHash) {
                await client.query(`UPDATE users
           SET password_hash = $1, failed_attempts = 0, locked_until = NULL
           WHERE id = $2`, [passwordHash, userId]);
                await client.query(`UPDATE refresh_tokens
           SET revoked_at = NOW()
           WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
            }
            const enumerator = await client.query(`SELECT id FROM enumerators WHERE user_id = $1`, [userId]);
            if (enumerator.rowCount) {
                await client.query(`UPDATE enumerators
           SET full_name = $1, phone = NULLIF($2, ''), is_active = $3
           WHERE user_id = $4`, [input.fullName, input.phone, existing.rows[0].is_active && input.role === 'ENUMERATOR', userId]);
            }
            else if (input.role === 'ENUMERATOR') {
                await client.query(`INSERT INTO enumerators (user_id, code, full_name, phone)
           VALUES ($1, $2, $3, NULLIF($4, ''))`, [userId, newEnumeratorCode(), input.fullName, input.phone]);
            }
            const result = await client.query(`${USER_SELECT} WHERE u.id = $1`, [userId]);
            return toUserRecord(result.rows[0]);
        });
    }
    async deactivate(userId) {
        return (0, pool_1.withTransaction)(async (client) => {
            const existing = await client.query(`SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE`, [userId]);
            if (!existing.rowCount)
                return null;
            await this.ensureActiveAdminRemains(client, userId, false);
            await client.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [userId]);
            await client.query(`UPDATE enumerators SET is_active = FALSE WHERE user_id = $1`, [userId]);
            await client.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
            const result = await client.query(`${USER_SELECT} WHERE u.id = $1`, [userId]);
            return toUserRecord(result.rows[0]);
        });
    }
    async activate(userId) {
        return (0, pool_1.withTransaction)(async (client) => {
            const existing = await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);
            if (!existing.rowCount)
                return null;
            await client.query(`UPDATE users SET is_active = TRUE, failed_attempts = 0, locked_until = NULL WHERE id = $1`, [userId]);
            await client.query(`UPDATE enumerators e
         SET is_active = EXISTS (
           SELECT 1
           FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           WHERE ur.user_id = e.user_id AND r.name = 'ENUMERATOR'
         )
         WHERE e.user_id = $1`, [userId]);
            const result = await client.query(`${USER_SELECT} WHERE u.id = $1`, [userId]);
            return toUserRecord(result.rows[0]);
        });
    }
    async ensureActiveAdminRemains(client, userId, willRemainAdmin) {
        if (willRemainAdmin)
            return;
        const result = await client.query(`SELECT COUNT(*)::text AS count
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.is_active = TRUE AND r.name = 'ADMIN' AND u.id <> $1`, [userId]);
        if (Number(result.rows[0].count) === 0) {
            throw new Error('Debe permanecer al menos un administrador activo.');
        }
    }
}
exports.UsersService = UsersService;
exports.usersService = new UsersService();
//# sourceMappingURL=users.service.js.map