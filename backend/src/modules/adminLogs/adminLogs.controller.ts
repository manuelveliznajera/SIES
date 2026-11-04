import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { query } from '../../database/pool';
import { writeApplicationError } from '../../services/observability';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

const frontendErrorSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  stack: z.string().max(30_000).optional(),
  path: z.string().max(1000).optional(),
  details: z.record(z.unknown()).optional(),
});

export async function listAuditEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { limit, offset } = listQuerySchema.parse(req.query);
    const result = await query(
      `SELECT a.id, a.user_id AS "userId", COALESCE(u.full_name, u.username, 'Usuario eliminado') AS "userName",
              a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
              a.changes, a.ip_address AS "ipAddress", a.user_agent AS "userAgent",
              a.origin, a.created_at AS "createdAt"
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.status(200).json({ success: true, events: result.rows });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: 'Parámetros de consulta inválidos.', code: 'VALIDATION_ERROR' });
      return;
    }
    next(error);
  }
}

export async function listApplicationErrors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { limit, offset } = listQuerySchema.parse(req.query);
    const result = await query(
      `SELECT e.id, e.source, e.severity, e.message, e.stack, e.path, e.method,
              e.user_id AS "userId", COALESCE(u.full_name, u.username) AS "userName",
              e.ip_address AS "ipAddress", e.user_agent AS "userAgent",
              e.details, e.created_at AS "createdAt"
       FROM application_error_logs e
       LEFT JOIN users u ON u.id = e.user_id
       ORDER BY e.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.status(200).json({ success: true, errors: result.rows });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: 'Parámetros de consulta inválidos.', code: 'VALIDATION_ERROR' });
      return;
    }
    next(error);
  }
}

export async function reportFrontendError(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = frontendErrorSchema.parse(req.body);
    await writeApplicationError({
      source: 'frontend',
      message: input.message,
      stack: input.stack,
      path: input.path,
      userId: req.user!.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: input.details,
    });
    res.status(202).json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, message: 'Datos del error inválidos.', code: 'VALIDATION_ERROR' });
      return;
    }
    next(error);
  }
}
