import type { Request } from 'express';
export interface AuditEventInput {
    userId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    changes?: Record<string, unknown>;
}
export declare function writeAuditEvent(req: Request, event: AuditEventInput): Promise<void>;
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
export declare function writeApplicationError(event: ApplicationErrorInput): Promise<void>;
//# sourceMappingURL=observability.d.ts.map