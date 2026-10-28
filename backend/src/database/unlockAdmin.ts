import { env } from '../config/env';
import pool, { withTransaction } from './pool';
import { logger } from '../utils/logger';

async function unlockAdmin(): Promise<void> {
  const username = env.SEED_ADMIN_USERNAME?.trim();
  const email = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();

  if (!username && !email) {
    throw new Error(
      'Define SEED_ADMIN_USERNAME o SEED_ADMIN_EMAIL para identificar la cuenta ADMIN existente.'
    );
  }

  const admin = await withTransaction(async (client) => {
    const result = await client.query<{ id: string; username: string }>(
      `SELECT u.id, u.username
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'ADMIN'
         AND (
           ($1::text IS NOT NULL AND LOWER(u.username) = LOWER($1))
           OR ($2::text IS NOT NULL AND LOWER(u.email) = LOWER($2))
         )
       FOR UPDATE OF u`,
      [username ?? null, email ?? null]
    );

    if (result.rowCount !== 1) {
      throw new Error(
        result.rowCount === 0
          ? 'No se encontró un administrador con ese username o email.'
          : 'Los datos indicados coinciden con más de un administrador. Define solo un identificador.'
      );
    }

    const account = result.rows[0];
    await client.query(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1`,
      [account.id]
    );

    return account;
  });

  logger.info('Intentos fallidos y bloqueo del administrador limpiados.', {
    username: admin.username,
  });
}

unlockAdmin()
  .catch((error: unknown) => {
    logger.error('No se pudo desbloquear el administrador.', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => pool.end());
