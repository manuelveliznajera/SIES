import { Request, Response, NextFunction } from 'express';
/**
 * POST /api/v1/auth/login
 * Autentica usuario y establece cookies httpOnly.
 */
export declare function login(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * POST /api/v1/auth/refresh
 * Renueva el access token usando el refresh token de la cookie.
 */
export declare function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * POST /api/v1/auth/logout
 * Revoca tokens y elimina cookies.
 */
export declare function logout(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /api/v1/auth/me
 * Devuelve los datos del usuario autenticado actual.
 */
export declare function me(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map