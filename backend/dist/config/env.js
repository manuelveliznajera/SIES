"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Cargar variables de entorno
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
const envSchema = zod_1.z.object({
    // Servidor
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.coerce.number().default(3001),
    API_VERSION: zod_1.z.string().default('v1'),
    // Base de datos
    DATABASE_URL: zod_1.z.string().url('DATABASE_URL debe ser una URL válida de PostgreSQL'),
    DATABASE_SSL: zod_1.z.enum(['true', 'false']).transform((value) => value === 'true').default('false'),
    DATABASE_POOL_MIN: zod_1.z.coerce.number().default(2),
    DATABASE_POOL_MAX: zod_1.z.coerce.number().default(10),
    // JWT
    JWT_SECRET: zod_1.z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
    JWT_ACCESS_EXPIRY: zod_1.z.string().default('15m'),
    JWT_REFRESH_EXPIRY: zod_1.z.string().default('7d'),
    // Cookies
    COOKIE_SECRET: zod_1.z.string().min(32, 'COOKIE_SECRET debe tener al menos 32 caracteres'),
    COOKIE_SECURE: zod_1.z.coerce.boolean().default(false),
    COOKIE_SAME_SITE: zod_1.z.enum(['strict', 'lax', 'none']).default('strict'),
    // CORS
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:5173'),
    // Rate limiting
    RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().default(900000),
    RATE_LIMIT_MAX_REQUESTS: zod_1.z.coerce.number().default(100),
    AUTH_RATE_LIMIT_MAX: zod_1.z.coerce.number().default(10),
    // Logs
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    // Reportes
    REPORTS_TEMP_DIR: zod_1.z.string().default('./tmp/reports'),
    MAX_EXPORT_ROWS: zod_1.z.coerce.number().default(50000),
    // Prefijo código encuestador
    ENUMERATOR_CODE_PREFIX: zod_1.z.string().default('ENC'),
    // Seeds (solo desarrollo)
    SEED_ADMIN_USERNAME: zod_1.z.string().min(3).optional(),
    SEED_ADMIN_EMAIL: zod_1.z.string().email().optional(),
    SEED_ADMIN_FULL_NAME: zod_1.z.string().min(1).optional(),
    SEED_ADMIN_PASSWORD: zod_1.z.string().min(12).optional(),
}).refine((values) => values.COOKIE_SAME_SITE !== 'none' || values.COOKIE_SECURE, {
    message: 'COOKIE_SECURE debe ser true cuando COOKIE_SAME_SITE=none',
    path: ['COOKIE_SECURE'],
});
/**
 * Valida las variables de entorno al arrancar el servidor.
 * Si falta una variable crítica, el proceso falla con un mensaje claro.
 */
function validateEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('❌ Error en variables de entorno:');
        result.error.errors.forEach((err) => {
            console.error(`  • ${err.path.join('.')}: ${err.message}`);
        });
        process.exit(1);
    }
    return result.data;
}
exports.env = validateEnv();
//# sourceMappingURL=env.js.map