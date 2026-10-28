import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface JwtPayload {
  userId: string;
  username: string;
  fullName?: string;
  roles: string[];
  enumeratorId?: string;
}

// Extender la interfaz de Express Request para incluir el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware de autenticación.
 * Verifica el token JWT almacenado en httpOnly cookie o en el header Authorization.
 * Si el token es inválido o falta, responde con 401.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Primero intentar desde cookie (más seguro)
  let token: string | undefined = req.cookies?.access_token;

  // Fallback: header Authorization (para clientes que no soporten cookies)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Autenticación requerida. Por favor inicia sesión.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'La sesión ha expirado. Por favor inicia sesión nuevamente.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    logger.warn('Token JWT inválido', {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      error: err instanceof Error ? err.message : 'Unknown',
    });

    res.status(401).json({
      success: false,
      message: 'Token de autenticación inválido.',
      code: 'TOKEN_INVALID',
    });
  }
}

/**
 * Middleware de autorización por roles.
 * Debe usarse DESPUÉS de authenticate.
 *
 * @example
 * router.get('/admin', authenticate, authorize(['ADMIN']), handler)
 * router.post('/interviews', authenticate, authorize(['ADMIN', 'ENUMERATOR']), handler)
 */
export function authorize(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Autenticación requerida.',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      logger.warn('Acceso denegado por roles insuficientes', {
        userId: req.user.userId,
        userRoles: req.user.roles,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción.',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}
