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
async function seedAdmin() {
    const username = env_1.env.SEED_ADMIN_USERNAME?.trim();
    const email = env_1.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const fullName = env_1.env.SEED_ADMIN_FULL_NAME?.trim();
    const password = env_1.env.SEED_ADMIN_PASSWORD;
    if (!username || !email || !fullName || !password) {
        throw new Error('Define SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL, SEED_ADMIN_FULL_NAME y SEED_ADMIN_PASSWORD en backend/.env.');
    }
    const passwordHash = await auth_service_1.authService.hashPassword(password);
    await (0, pool_1.withTransaction)(async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext('encuestaapp-seed-admin'))");
        const existingAdmin = await client.query(`SELECT u.id
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'ADMIN'
       LIMIT 1`);
        if (existingAdmin.rowCount) {
            throw new Error('Ya existe un administrador. No se creó ningún usuario.');
        }
        const insertedUser = await client.query(`INSERT INTO users (username, email, password_hash, full_name, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id`, [username, email, passwordHash, fullName]);
        const assignedRole = await client.query(`INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = 'ADMIN'`, [insertedUser.rows[0].id]);
        if (!assignedRole.rowCount) {
            throw new Error('El rol ADMIN no existe. Ejecuta primero las migraciones.');
        }
    });
    logger_1.logger.info('Primer administrador creado correctamente.', { username });
}
seedAdmin()
    .catch((error) => {
    logger_1.logger.error('No se pudo crear el administrador inicial.', {
        error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
})
    .finally(() => pool_1.default.end());
//# sourceMappingURL=seedAdmin.js.map