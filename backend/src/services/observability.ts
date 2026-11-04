import type { Request } from 'express';
import { query } from '../database/pool';
import { logger } from '../utils/logger';

export interface AuditEventInput {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  changes?: Record<string, unknown>;
}

export async function writeAuditEvent(req: Request, event: AuditEventInput): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id, changes, ip_address, user_agent, origin, created_at)
       VALUES ($1, $2, $3, $4::uuid, $5::jsonb, $6, $7, $8, NOW())`,
      [
        event.userId === undefined ? req.user?.userId ?? null : event.userId,
        event.action,
        event.entityType ?? null,
        event.entityId ?? null,
        JSON.stringify(event.changes ?? {}),
        req.ip?.slice(0, 45) ?? null,
        req.get('user-agent')?.slice(0, 500) ?? null,
        (req.get('origin') ?? req.get('referer') ?? '').slice(0, 500) || null,
      ]
    );
  } catch (error) {
    logger.error('No se pudo guardar el evento de auditoría', {
      action: event.action,
      entityType: event.entityType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface ApplicationErrorInput {
  source: 'backend' | 'frontend';
  severity?: 'error' | 'warning';
  message: string;
  stack?: string | null;
  path?: string | null;
  method?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}

export async function writeApplicationError(event: ApplicationErrorInput): Promise<void> {
  try {
    await query(
      `INSERT INTO application_error_logs
         (source, severity, message, stack, path, method, user_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
      [
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
      ]
    );
  } catch (error) {
    logger.error('No se pudo guardar el error en la bitácora de aplicación', {
      source: event.source,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
