import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  // Servidor
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_VERSION: z.string().default('v1'),

  // Base de datos
  DATABASE_URL: z.string().url('DATABASE_URL debe ser una URL válida de PostgreSQL'),
  DATABASE_SSL: z.enum(['true', 'false']).transform((value) => value === 'true').default('false'),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Cookies
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET debe tener al menos 32 caracteres'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('strict'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Logs
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Reportes
  REPORTS_TEMP_DIR: z.string().default('./tmp/reports'),
  MAX_EXPORT_ROWS: z.coerce.number().default(50000),

  // Prefijo código encuestador
  ENUMERATOR_CODE_PREFIX: z.string().default('ENC'),

  // Seeds (solo desarrollo)
  SEED_ADMIN_USERNAME: z.string().min(3).optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_FULL_NAME: z.string().min(1).optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),
}).refine(
  (values) => values.COOKIE_SAME_SITE !== 'none' || values.COOKIE_SECURE,
  {
    message: 'COOKIE_SECURE debe ser true cuando COOKIE_SAME_SITE=none',
    path: ['COOKIE_SECURE'],
  }
);

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

export const env = validateEnv();
export type Env = typeof env;
