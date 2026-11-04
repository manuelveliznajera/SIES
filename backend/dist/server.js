"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const pool_1 = require("./database/pool");
const observability_1 = require("./services/observability");
async function bootstrap() {
    // Verificar conexión a la base de datos antes de aceptar tráfico
    const dbOk = await (0, pool_1.testConnection)();
    if (!dbOk) {
        logger_1.logger.error('No se pudo establecer conexión con la base de datos. Abortando.');
        process.exit(1);
    }
    const app = (0, app_1.createApp)();
    const server = app.listen(env_1.env.PORT, () => {
        logger_1.logger.info(`🚀 EncuestaApp API iniciada`, {
            port: env_1.env.PORT,
            environment: env_1.env.NODE_ENV,
            apiBase: `/api/${env_1.env.API_VERSION}`,
        });
    });
    // Manejo elegante de señales de terminación
    const shutdown = async (signal) => {
        logger_1.logger.info(`Señal ${signal} recibida. Cerrando servidor...`);
        server.close(() => {
            logger_1.logger.info('Servidor HTTP cerrado.');
            process.exit(0);
        });
        // Forzar cierre después de 10 segundos
        setTimeout(() => {
            logger_1.logger.error('No se pudo cerrar elegantemente. Forzando cierre.');
            process.exit(1);
        }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
        logger_1.logger.error('Promesa rechazada no manejada', {
            reason: reason instanceof Error ? reason.message : String(reason),
        });
        void (0, observability_1.writeApplicationError)({
            source: 'backend',
            message: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
            details: { scope: 'process', event: 'unhandledRejection' },
        });
    });
    process.on('uncaughtException', (err) => {
        logger_1.logger.error('Excepción no capturada. Cerrando proceso.', {
            error: err.message,
            stack: err.stack,
        });
        const exitTimer = setTimeout(() => process.exit(1), 2000);
        exitTimer.unref();
        void (0, observability_1.writeApplicationError)({
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
//# sourceMappingURL=server.js.map