"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = query;
exports.getClient = getClient;
exports.withTransaction = withTransaction;
exports.testConnection = testConnection;
const pg_1 = require("pg");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
/**
 * Pool de conexiones a PostgreSQL.
 * Singleton: toda la aplicación comparte el mismo pool.
 */
const pool = new pg_1.Pool({
    connectionString: env_1.env.DATABASE_URL,
    ssl: env_1.env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    min: env_1.env.DATABASE_POOL_MIN,
    max: env_1.env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
pool.on('error', (err) => {
    logger_1.logger.error('Error inesperado en cliente PostgreSQL inactivo', { error: err.message });
});
pool.on('connect', () => {
    logger_1.logger.debug('Nueva conexión establecida al pool de PostgreSQL');
});
/**
 * Ejecuta una consulta parametrizada.
 * Usa $1, $2, ... para los parámetros (previene inyección SQL).
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (env_1.env.NODE_ENV === 'development') {
            logger_1.logger.debug('Consulta ejecutada', { text: text.slice(0, 100), duration, rowCount: result.rowCount });
        }
        return {
            rows: result.rows,
            rowCount: result.rowCount ?? 0,
        };
    }
    catch (err) {
        logger_1.logger.error('Error en consulta SQL', {
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
async function getClient() {
    return pool.connect();
}
/**
 * Ejecuta múltiples operaciones dentro de una transacción.
 * Si cualquier operación falla, hace ROLLBACK automático.
 */
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        await client.query('ROLLBACK');
        logger_1.logger.error('Transacción revertida', {
            error: err instanceof Error ? err.message : String(err),
        });
        throw err;
    }
    finally {
        client.release();
    }
}
/**
 * Prueba la conexión a la base de datos.
 * Usada al iniciar el servidor y en el endpoint de health check.
 */
async function testConnection() {
    try {
        const result = await query('SELECT NOW() as now');
        logger_1.logger.info('Conexión a PostgreSQL establecida', { serverTime: result.rows[0].now });
        return true;
    }
    catch (err) {
        logger_1.logger.error('No se pudo conectar a PostgreSQL', {
            error: err instanceof Error ? err.message : String(err),
        });
        return false;
    }
}
exports.default = pool;
//# sourceMappingURL=pool.js.map