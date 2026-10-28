import { Request, Response, NextFunction } from 'express';
/**
 * Manejador global de errores.
 * Debe registrarse ÚLTIMO en la cadena de middleware de Express.
 */
export declare function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void;
/**
 * Middleware para rutas no encontradas (404).
 */
export declare function notFoundHandler(req: Request, res: Response): void;
//# sourceMappingURL=errorHandler.d.ts.map