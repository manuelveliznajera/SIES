import { Request, Response, NextFunction } from 'express';
/**
 * Registra en audit_logs las acciones administrativas importantes.
 * Solo se activa para métodos de escritura (POST, PUT, PATCH, DELETE).
 */
export declare function auditLog(action: string, entityType: string): (req: Request, _res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auditLog.d.ts.map