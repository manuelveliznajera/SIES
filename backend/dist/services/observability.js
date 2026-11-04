"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditEvent = writeAuditEvent;
exports.writeApplicationError = writeApplicationError;
const pool_1 = require("../database/pool");
const logger_1 = require("../utils/logger");
async function writeAuditEvent(req, event) {
    try {
        await (0, pool_1.query)(`INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, origin, created_at)
       VALUES ($1, $2, $3, $4::uuid, $5::jsonb, $6, $7, $8, NOW())`, [
            event.userId === undefined ? req.user?.userId ?? null : event.userId,
            event.action,
            event.entityType ?? null,
            event.entityId ?? null,
            JSON.stringify(event.changes ?? {}),
            req.ip?.slice(0, 45) ?? null,
            req.get('user-agent')?.slice(0, 500) ?? null,
            (req.get('origin') ?? req.get('referer') ?? '').slice(0, 500) || null,
        ]);
    }
    catch (error) {
        logger_1.logger.error('No se pudo guardar el evento de auditoría', {
            action: event.action,
            entityType: event.entityType,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
async function writeApplicationError(event) {
    try {
        await (0, pool_1.query)(`INSERT INTO application_error_logs
         (source, severity, message, stack, path, method, user_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`, [
            event.source,
            event.severity ?? 'error',
            event.message.slice(0, 8000),
            event.stack?.slice(0, 30000) ?? null,
            event.path?.slice(0, 1000) ?? null,
            event.method?.slice(0, 12) ?? null,
            event.userId ?? null,
            event.ipAddress?.slice(0, 45) ?? null,
            event.userAgent?.slice(0, 500) ?? null,
            JSON.stringify(event.details ?? {}),
        ]);
    }
    catch (error) {
        logger_1.logger.error('No se pudo guardar el error en la bitácora de aplicación', {
            source: event.source,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
//# sourceMappingURL=observability.js.map