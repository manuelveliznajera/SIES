"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const auth_service_1 = require("../modules/auth/auth.service");
const env_1 = require("../config/env");
const pool_1 = __importStar(require("./pool"));
const logger_1 = require("../utils/logger");
async function resetAdminPassword() {
    const username = env_1.env.SEED_ADMIN_USERNAME?.trim();
    const email = env_1.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = env_1.env.SEED_ADMIN_PASSWORD;
    if ((!username && !email) || !password) {
        throw new Error('Define el username o email existente del administrador y SEED_ADMIN_PASSWORD en backend/.env.');
    }
    const passwordHash = await auth_service_1.authService.hashPassword(password);
    const admin = await (0, pool_1.withTransaction)(async (client) => {
        const result = await client.query(`SELECT u.id, u.username
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'ADMIN'
         AND (
           ($1::text IS NOT NULL AND LOWER(u.username) = LOWER($1))
           OR ($2::text IS NOT NULL AND LOWER(u.email) = LOWER($2))
         )
       FOR UPDATE OF u`, [username ?? null, email ?? null]);
        if (result.rowCount !== 1) {
            throw new Error(result.rowCount === 0
                ? 'No se encontró un administrador con ese username o email.'
                : 'Los datos indicados coinciden con más de un administrador. Define solo un identificador.');
        }
        const account = result.rows[0];
        await client.query(`UPDATE users
       SET password_hash = $1, failed_attempts = 0, locked_until = NULL
       WHERE id = $2`, [passwordHash, account.id]);
        await client.query(`UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`, [account.id]);
        return account;
    });
    logger_1.logger.info('Contraseña del administrador restablecida correctamente.', {
        username: admin.username,
    });
}
resetAdminPassword()
    .catch((error) => {
    logger_1.logger.error('No se pudo restablecer la contraseña del administrador.', {
        error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
})
    .finally(() => pool_1.default.end());
//# sourceMappingURL=resetAdminPassword.js.map