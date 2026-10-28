import { Request, Response, NextFunction } from 'express';
import { query } from '../database/pool';
import { logger } from '../utils/logger';

/**
 * Registra en audit_logs las acciones administrativas importantes.
 * Solo se activa para métodos de escritura (POST, PUT, PATCH, DELETE).
 */
export function auditLog(action: string, entityType: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Solo auditar cuando hay usuario autenticado
    if (!req.user) {
      next();
      return;
    }

    try {
      const entityId =
        req.params.id ??
        req.params.surveyId ??
        req.params.interviewId ??
        null;

      await query(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, changes, ip_address, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4::uuid, $5::jsonb, $6, NOW())`,
        [
          req.user.userId,
          action,
          entityType,
          entityId ?? null,
          JSON.stringify({ body: sanitizeBody(req.body) }),
          req.ip ?? 'unknown',
        ]
      );
    } catch (err) {
      // El fallo del audit log NO debe bloquear la operación principal
      logger.error('Error al registrar en audit_logs', {
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
function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['password', 'password_hash', 'token', 'secret', 'credential'];
  const sanitized = { ...body };
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
}
