import { authService } from '../modules/auth/auth.service';
import { env } from '../config/env';
import pool, { withTransaction } from './pool';
import { logger } from '../utils/logger';

async function resetAdminPassword(): Promise<void> {
  const username = env.SEED_ADMIN_USERNAME?.trim();
  const email = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.SEED_ADMIN_PASSWORD;

  if ((!username && !email) || !password) {
    throw new Error(
      'Define el username o email existente del administrador y SEED_ADMIN_PASSWORD en backend/.env.'
    );
  }

  const passwordHash = await authService.hashPassword(password);

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
      `UPDATE users
       SET password_hash = $1, failed_attempts = 0, locked_until = NULL
       WHERE id = $2`,
      [passwordHash, account.id]
    );
    await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [account.id]
    );

    return account;
  });

  logger.info('Contraseña del administrador restablecida correctamente.', {
    username: admin.username,
  });
}

resetAdminPassword()
  .catch((error: unknown) => {
    logger.error('No se pudo restablecer la contraseña del administrador.', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => pool.end());
