import { Pool, PoolClient } from 'pg';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Pool de conexiones a PostgreSQL.
 * Singleton: toda la aplicación comparte el mismo pool.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  min: env.DATABASE_POOL_MIN,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Error inesperado en cliente PostgreSQL inactivo', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('Nueva conexión establecida al pool de PostgreSQL');
});

/**
 * Ejecuta una consulta parametrizada.
 * Usa $1, $2, ... para los parámetros (previene inyección SQL).
 */
export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (env.NODE_ENV === 'development') {
      logger.debug('Consulta ejecutada', { text: text.slice(0, 100), duration, rowCount: result.rowCount });
    }

    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  } catch (err) {
    logger.error('Error en consulta SQL', {
      text: text.slice(0, 100),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Obtiene un cliente del pool para manejar transacciones manualmente.
 * IMPORTANTE: siempre liberar el cliente con client.release()
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Ejecuta múltiples operaciones dentro de una transacción.
 * Si cualquier operación falla, hace ROLLBACK automático.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Transacción revertida', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Prueba la conexión a la base de datos.
 * Usada al iniciar el servidor y en el endpoint de health check.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query<{ now: string }>('SELECT NOW() as now');
    logger.info('Conexión a PostgreSQL establecida', { serverTime: result.rows[0].now });
    return true;
  } catch (err) {
    logger.error('No se pudo conectar a PostgreSQL', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export default pool;
