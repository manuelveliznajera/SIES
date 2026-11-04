import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { testConnection } from './database/pool';
import { writeApplicationError } from './services/observability';

async function bootstrap() {
  // Verificar conexión a la base de datos antes de aceptar tráfico
  const dbOk = await testConnection();
  if (!dbOk) {
    logger.error('No se pudo establecer conexión con la base de datos. Abortando.');
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 EncuestaApp API iniciada`, {
      port: env.PORT,
      environment: env.NODE_ENV,
      apiBase: `/api/${env.API_VERSION}`,
    });
  });

  // Manejo elegante de señales de terminación
  const shutdown = async (signal: string) => {
    logger.info(`Señal ${signal} recibida. Cerrando servidor...`);
    server.close(() => {
      logger.info('Servidor HTTP cerrado.');
      process.exit(0);
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      logger.error('No se pudo cerrar elegantemente. Forzando cierre.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Promesa rechazada no manejada', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
    void writeApplicationError({
      source: 'backend',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      details: { scope: 'process', event: 'unhandledRejection' },
    });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Excepción no capturada. Cerrando proceso.', {
      error: err.message,
      stack: err.stack,
    });
    const exitTimer = setTimeout(() => process.exit(1), 2000);
    exitTimer.unref();
    void writeApplicationError({
      source: 'backend',
      message: err.message,
      stack: err.stack,
      details: { scope: 'process', event: 'uncaughtException' },
    }).finally(() => {
      clearTimeout(exitTimer);
      process.exit(1);
    });
  });
}

bootstrap();
