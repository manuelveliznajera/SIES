import { authService } from '../modules/auth/auth.service';
import { env } from '../config/env';
import pool, { withTransaction } from './pool';
import { logger } from '../utils/logger';

async function seedAdmin(): Promise<void> {
  const username = env.SEED_ADMIN_USERNAME?.trim();
  const email = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const fullName = env.SEED_ADMIN_FULL_NAME?.trim();
  const password = env.SEED_ADMIN_PASSWORD;

  if (!username || !email || !fullName || !password) {
    throw new Error(
      'Define SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL, SEED_ADMIN_FULL_NAME y SEED_ADMIN_PASSWORD en backend/.env.'
    );
  }

  const passwordHash = await authService.hashPassword(password);

  await withTransaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('encuestaapp-seed-admin'))"
    );

    const existingAdmin = await client.query(
      `SELECT u.id
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'ADMIN'
       LIMIT 1`
    );

    if (existingAdmin.rowCount) {
      throw new Error('Ya existe un administrador. No se creó ningún usuario.');
    }

    const insertedUser = await client.query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, full_name, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id`,
      [username, email, passwordHash, fullName]
    );

    const assignedRole = await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = 'ADMIN'`,
      [insertedUser.rows[0].id]
    );

    if (!assignedRole.rowCount) {
      throw new Error('El rol ADMIN no existe. Ejecuta primero las migraciones.');
    }
  });

  logger.info('Primer administrador creado correctamente.', { username });
}

seedAdmin()
  .catch((error: unknown) => {
    logger.error('No se pudo crear el administrador inicial.', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => pool.end());
