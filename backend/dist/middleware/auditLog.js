"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = auditLog;
const pool_1 = require("../database/pool");
const logger_1 = require("../utils/logger");
/**
 * Registra en audit_logs las acciones administrativas importantes.
 * Solo se activa para métodos de escritura (POST, PUT, PATCH, DELETE).
 */
function auditLog(action, entityType) {
    return async (req, _res, next) => {
        // Solo auditar cuando hay usuario autenticado
        if (!req.user) {
            next();
            return;
        }
        try {
            const entityId = req.params.id ??
                req.params.surveyId ??
                req.params.interviewId ??
                null;
            await (0, pool_1.query)(`INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, changes, ip_address, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::uuid, $5::jsonb, $6, NOW())`, [
                req.user.userId,
                action,
                entityType,
                entityId ?? null,
                JSON.stringify({ body: sanitizeBody(req.body) }),
                req.ip ?? 'unknown',
            ]);
        }
        catch (err) {
            // El fallo del audit log NO debe bloquear la operación principal
            logger_1.logger.error('Error al registrar en audit_logs', {
                error: err instanceof Error ? err.message : String(err),
                action,
                entityType,
                userId: req.user.userId,
            });
        }
        next();
    };
}
/**
 * Elimina campos sensibles del body antes de guardarlos en el log.
 */
function sanitizeBody(body) {
    const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'credential'];
    const sanitized = { ...body };
    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
        }
    }
    return sanitized;
}
//# sourceMappingURL=auditLog.js.map