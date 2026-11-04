import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { loginSchema, refreshSchema } from './auth.validators';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { writeAuditEvent } from '../../services/observability';

const isProduction = env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  // En desarrollo la app se prueba por HTTP desde localhost o una IP LAN.
  // Forzar cookies Secure en ese contexto hace que navegadores móviles las rechacen.
  secure: isProduction && env.COOKIE_SECURE,
  sameSite: isProduction ? env.COOKIE_SAME_SITE : 'lax' as const,
  path: '/',
};

const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;     // 15 minutos
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 días

/**
 * POST /api/v1/auth/login
 * Autentica usuario y establece cookies httpOnly.
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, password } = loginSchema.shape.body.parse(req.body);

    const result = await authService.login(identifier, password);

    if (!result.success || !result.accessToken || !result.refreshToken || !result.user) {
      await writeAuditEvent(req, {
        userId: null,
        action: 'auth.login.failed',
        entityType: 'auth_session',
        changes: { identifier, resultCode: result.code ?? 'AUTH_FAILED' },
      });
      res.status(401).json({
        success: false,
        message: result.message ?? 'Error de autenticación.',
        code: result.code ?? 'AUTH_FAILED',
      });
      return;
    }

    // Almacenar tokens en httpOnly cookies (nunca en el body por seguridad XSS)
    res.cookie('access_token', result.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });

    res.cookie('refresh_token', result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_COOKIE_MAX_AGE,
      path: '/api/v1/auth/refresh', // Solo enviado a este endpoint
    });

    await writeAuditEvent(req, {
      userId: result.user.id,
      action: 'auth.login.succeeded',
      entityType: 'auth_session',
      changes: { username: result.user.username, roles: result.user.roles },
    });

    res.status(200).json({
      success: true,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/refresh
 * Renueva el access token usando el refresh token de la cookie.
 */
export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Preferir cookie sobre body (más seguro)
    const token =
      req.cookies?.refresh_token ??
      refreshSchema.shape.body.safeParse(req.body).data?.refreshToken;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Se requiere refresh token.',
        code: 'REFRESH_TOKEN_MISSING',
      });
      return;
    }

    const result = await authService.refreshAccessToken(token);

    if (!result.success || !result.accessToken || !result.refreshToken) {
      // Limpiar cookies inválidas
      res.clearCookie('access_token', COOKIE_OPTIONS);
      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, path: '/api/v1/auth/refresh' });

      res.status(401).json({
        success: false,
        message: result.message ?? 'Sesión inválida.',
        code: result.code ?? 'SESSION_INVALID',
      });
      return;
    }

    res.cookie('access_token', result.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });

    res.cookie('refresh_token', result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_COOKIE_MAX_AGE,
      path: '/api/v1/auth/refresh',
    });

    res.status(200).json({
      success: true,
      user: result.user,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Revoca tokens y elimina cookies.
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user?.userId) {
      await authService.logout(req.user.userId);
      await writeAuditEvent(req, {
        action: 'auth.logout',
        entityType: 'auth_session',
        changes: { username: req.user.username },
      });
    }

    res.clearCookie('access_token', COOKIE_OPTIONS);
    res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, path: '/api/v1/auth/refresh' });

    res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Devuelve los datos del usuario autenticado actual.
 */
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'No autenticado.' });
    return;
  }

  res.status(200).json({
    success: true,
    user: {
      id: req.user.userId,
      username: req.user.username,
      fullName: req.user.fullName ?? req.user.username,
      roles: req.user.roles,
      enumeratorId: req.user.enumeratorId ?? null,
    },
  });
}
