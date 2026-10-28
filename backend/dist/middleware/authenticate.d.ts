import { Request, Response, NextFunction } from 'express';
export interface JwtPayload {
    userId: string;
    username: string;
    fullName?: string;
    roles: string[];
    enumeratorId?: string;
}
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
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware de autorización por roles.
 * Debe usarse DESPUÉS de authenticate.
 *
 * @example
 * router.get('/admin', authenticate, authorize(['ADMIN']), handler)
 * router.post('/interviews', authenticate, authorize(['ADMIN', 'ENUMERATOR']), handler)
 */
export declare function authorize(allowedRoles: string[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authenticate.d.ts.map