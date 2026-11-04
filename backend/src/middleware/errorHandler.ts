import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { writeApplicationError } from '../services/observability';

/**
 * Respuesta de error estándar de la API.
 */
interface ApiError {
  success: false;
  message: string;
  code: string;
  errors?: unknown[];
}

/**
 * Manejador global de errores.
 * Debe registrarse ÚLTIMO en la cadena de middleware de Express.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Error de validación Zod
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos.',
      code: 'VALIDATION_ERROR',
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    } satisfies ApiError & { errors: unknown[] });
    return;
  }

  // Error de constraint de PostgreSQL
  if (isPostgresError(err)) {
    const pgError = err as NodeJS.ErrnoException & { code?: string; constraint?: string };

    if (pgError.code === '23505') {
      // unique_violation
      res.status(409).json({
        success: false,
        message: 'Ya existe un registro con estos datos.',
        code: 'DUPLICATE_ENTRY',
      } satisfies ApiError);
      return;
    }

    if (pgError.code === '23503') {
      // foreign_key_violation
      res.status(409).json({
        success: false,
        message: 'El registro referenciado no existe.',
        code: 'FOREIGN_KEY_VIOLATION',
      } satisfies ApiError);
      return;
    }
  }

  // Log del error completo (sin exponerlo al cliente)
  void writeApplicationError({
    source: 'backend',
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    details: isPostgresError(err) && 'code' in err ? { databaseCode: String(err.code) } : {},
  });
  logger.error('Error no manejado', {
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
  } satisfies ApiError);
}

/**
 * Middleware para rutas no encontradas (404).
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `La ruta ${req.method} ${req.path} no existe.`,
    code: 'NOT_FOUND',
  } satisfies ApiError);
}

function isPostgresError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err;
}
