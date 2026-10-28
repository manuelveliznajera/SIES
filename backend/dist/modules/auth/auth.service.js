"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const pool_1 = require("../../database/pool");
const env_1 = require("../../config/env");
const logger_1 = require("../../utils/logger");
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_MINUTES = 15;
/**
 * Servicio de autenticación.
 * Gestiona login, tokens JWT, refresh tokens y bloqueo de cuentas.
 */
class AuthService {
    /**
     * Intenta autenticar a un usuario con username/email y contraseña.
     * Implementa bloqueo temporal tras intentos fallidos.
     */
    async login(identifier, password) {
        // Buscar usuario por username o email
        const result = await (0, pool_1.query)(`SELECT
        u.id, u.username, u.email, u.password_hash, u.full_name,
        u.is_active, u.failed_attempts, u.locked_until, u.last_login,
        ARRAY_AGG(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
        e.id AS enumerator_id
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN enumerators e ON e.user_id = u.id
      WHERE (LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1))
      GROUP BY u.id, e.id`, [identifier]);
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
        // Verificar bloqueo temporal
        if (user.locked_until && new Date() < new Date(user.locked_until)) {
            const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
            return {
                success: false,
                message: `Cuenta bloqueada temporalmente. Intenta nuevamente en ${minutesLeft} minuto(s).`,
                code: 'ACCOUNT_LOCKED',
            };
        }
        // Verificar contraseña
        const passwordValid = await bcrypt_1.default.compare(password, user.password_hash);
        if (!passwordValid) {
            await this.handleFailedAttempt(user.id, user.failed_attempts);
            return {
                success: false,
                message: 'Credenciales incorrectas.',
                code: 'INVALID_CREDENTIALS',
            };
        }
        // Login exitoso: resetear contador de intentos
        await (0, pool_1.query)(`UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW()
       WHERE id = $1`, [user.id]);
        // Generar tokens
        const { accessToken, refreshToken } = await this.generateTokens(user);
        logger_1.logger.info('Login exitoso', { userId: user.id, username: user.username });
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
    async refreshAccessToken(refreshToken) {
        const tokenHash = this.hashToken(refreshToken);
        const result = await (0, pool_1.query)(`SELECT user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
        if (result.rowCount === 0) {
            return { success: false, message: 'Token inválido.', code: 'TOKEN_INVALID' };
        }
        const tokenRow = result.rows[0];
        if (tokenRow.revoked_at) {
            logger_1.logger.warn('Intento de uso de refresh token revocado', { tokenHash: tokenHash.slice(0, 8) });
            return { success: false, message: 'Token revocado.', code: 'TOKEN_REVOKED' };
        }
        if (new Date() > new Date(tokenRow.expires_at)) {
            return { success: false, message: 'Sesión expirada. Por favor inicia sesión nuevamente.', code: 'TOKEN_EXPIRED' };
        }
        // Obtener datos del usuario
        const userResult = await (0, pool_1.query)(`SELECT u.id, u.username, u.email, u.full_name, u.is_active,
              0 AS failed_attempts, NULL AS locked_until, NULL AS last_login,
              ARRAY_AGG(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
              e.id AS enumerator_id
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN enumerators e ON e.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id, e.id`, [tokenRow.user_id]);
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
    async logout(userId) {
        await (0, pool_1.query)(`UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
        logger_1.logger.info('Logout: refresh tokens revocados', { userId });
    }
    /**
     * Hashea una contraseña con bcrypt.
     */
    async hashPassword(password) {
        return bcrypt_1.default.hash(password, BCRYPT_ROUNDS);
    }
    // ── Métodos privados ──────────────────────────────────────
    async generateTokens(user, revokeTokenHash) {
        const payload = {
            userId: user.id,
            username: user.username,
            fullName: user.full_name,
            roles: user.roles ?? [],
            enumeratorId: user.enumerator_id ?? undefined,
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
            expiresIn: Math.ceil(this.parseDuration(env_1.env.JWT_ACCESS_EXPIRY) / 1000),
            issuer: 'encuestaapp',
        });
        // Generar refresh token seguro
        const rawRefreshToken = crypto_1.default.randomBytes(64).toString('hex');
        const tokenHash = this.hashToken(rawRefreshToken);
        await (0, pool_1.withTransaction)(async (client) => {
            // Revocar token anterior si se está rotando
            if (revokeTokenHash) {
                await client.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [revokeTokenHash]);
            }
            // Guardar nuevo refresh token (hash, nunca el token en claro)
            const expiresAt = new Date(Date.now() + this.parseDuration(env_1.env.JWT_REFRESH_EXPIRY));
            await client.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`, [user.id, tokenHash, expiresAt]);
        });
        return { accessToken, refreshToken: rawRefreshToken };
    }
    async handleFailedAttempt(userId, currentAttempts) {
        const newAttempts = currentAttempts + 1;
        let lockedUntil = null;
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
            logger_1.logger.warn('Cuenta bloqueada por intentos fallidos', { userId, attempts: newAttempts });
        }
        await (0, pool_1.query)(`UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3`, [newAttempts, lockedUntil, userId]);
    }
    hashToken(token) {
        return crypto_1.default.createHash('sha256').update(token).digest('hex');
    }
    /** Simula el tiempo de un bcrypt.compare para prevenir timing attacks */
    async simulateHashCheck() {
        const dummy = '$2b$12$invalidhashtopreventtimingattacks.invalidhash.invalid';
        await bcrypt_1.default.compare('dummy', dummy).catch(() => { });
    }
    parseDuration(duration) {
        const match = /^(\d+)([smhd])$/.exec(duration);
        if (!match) {
            throw new Error(`Formato de duración JWT inválido: ${duration}`);
        }
        const [, num, unit] = match;
        const n = parseInt(num);
        const multipliers = {
            s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000,
        };
        return n * (multipliers[unit] ?? 86_400_000);
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map