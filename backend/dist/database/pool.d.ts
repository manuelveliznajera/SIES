import { Pool, PoolClient } from 'pg';
/**
 * Pool de conexiones a PostgreSQL.
 * Singleton: toda la aplicación comparte el mismo pool.
 */
declare const pool: Pool;
/**
 * Ejecuta una consulta parametrizada.
 * Usa $1, $2, ... para los parámetros (previene inyección SQL).
 */
export declare function query<T extends object = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{
    rows: T[];
    rowCount: number;
}>;
/**
 * Obtiene un cliente del pool para manejar transacciones manualmente.
 * IMPORTANTE: siempre liberar el cliente con client.release()
 */
export declare function getClient(): Promise<PoolClient>;
/**
 * Ejecuta múltiples operaciones dentro de una transacción.
 * Si cualquier operación falla, hace ROLLBACK automático.
 */
export declare function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
/**
 * Prueba la conexión a la base de datos.
 * Usada al iniciar el servidor y en el endpoint de health check.
 */
export declare function testConnection(): Promise<boolean>;
export default pool;
//# sourceMappingURL=pool.d.ts.map