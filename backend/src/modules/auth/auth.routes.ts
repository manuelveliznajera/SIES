import { Router } from 'express';
import { login, refreshToken, logout, me } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';

export const authRouter = Router();

/**
 * POST /api/v1/auth/login
 * Body: { identifier: string, password: string }
 */
authRouter.post('/login', login);

/**
 * POST /api/v1/auth/refresh
 * Cookie: refresh_token (httpOnly) o Body: { refreshToken: string }
 */
authRouter.post('/refresh', refreshToken);

/**
 * POST /api/v1/auth/logout
 * Requiere autenticación. Revoca sesión y elimina cookies.
 */
authRouter.post('/logout', authenticate, logout);

/**
 * GET /api/v1/auth/me
 * Devuelve el usuario autenticado actual.
 */
authRouter.get('/me', authenticate, me);
