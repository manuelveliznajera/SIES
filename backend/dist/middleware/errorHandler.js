"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
/**
 * Manejador global de errores.
 * Debe registrarse ÚLTIMO en la cadena de middleware de Express.
 */
function errorHandler(err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    // Error de validación Zod
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            message: 'Datos de entrada inválidos.',
            code: 'VALIDATION_ERROR',
            errors: err.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }
    // Error de constraint de PostgreSQL
    if (isPostgresError(err)) {
        const pgError = err;
        if (pgError.code === '23505') {
            // unique_violation
            res.status(409).json({
                success: false,
                message: 'Ya existe un registro con estos datos.',
                code: 'DUPLICATE_ENTRY',
            });
            return;
        }
        if (pgError.code === '23503') {
            // foreign_key_violation
            res.status(409).json({
                success: false,
                message: 'El registro referenciado no existe.',
                code: 'FOREIGN_KEY_VIOLATION',
            });
            return;
        }
    }
    // Log del error completo (sin exponerlo al cliente)
    logger_1.logger.error('Error no manejado', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.userId,
    });
    // Error genérico: no exponer detalles en producción
    const isDev = process.env.NODE_ENV === 'development';
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor.',
        code: 'INTERNAL_ERROR',
        ...(isDev && { details: err.message }),
    });
}
/**
 * Middleware para rutas no encontradas (404).
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: `La ruta ${req.method} ${req.path} no existe.`,
        code: 'NOT_FOUND',
    });
}
function isPostgresError(err) {
    return typeof err === 'object' && err !== null && 'code' in err;
}
//# sourceMappingURL=errorHandler.js.map