import { z } from 'zod';

const apiBase = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/admin-logs`;

const auditEventSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  userName: z.string(),
  action: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  changes: z.unknown(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  origin: z.string().nullable(),
  createdAt: z.string(),
});

const applicationErrorSchema = z.object({
  id: z.string(),
  source: z.enum(['backend', 'frontend']),
  severity: z.enum(['error', 'warning']),
  message: z.string(),
  stack: z.string().nullable(),
  path: z.string().nullable(),
  method: z.string().nullable(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  details: z.unknown(),
  createdAt: z.string(),
});

export type AuditEventRecord = z.infer<typeof auditEventSchema>;
export type ApplicationErrorRecord = z.infer<typeof applicationErrorSchema>;

async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const request = { ...init, credentials: 'include' as const };
  const response = await fetch(url, request);
  if (response.status !== 401) return response;
  const refresh = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/v1/auth/refresh`, {
    method: 'POST', credentials: 'include',
  });
  return refresh.ok ? fetch(url, request) : response;
}

async function readList<T>(response: Response, key: 'events' | 'errors', schema: z.ZodType<T>) {
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : 'No se pudieron cargar los registros de administración.';
    throw new Error(message);
  }
  const listSchema = z.object({ success: z.literal(true) }).extend({ [key]: z.array(schema) });
  const parsed = listSchema.safeParse(payload);
  if (!parsed.success) throw new Error('El servidor devolvió registros de administración inválidos.');
  return parsed.data[key] as T[];
}

export async function listAuditEvents(): Promise<AuditEventRecord[]> {
  const response = await authenticatedFetch(`${apiBase}/audit?limit=100`);
  return readList(response, 'events', auditEventSchema);
}

export async function listApplicationErrors(): Promise<ApplicationErrorRecord[]> {
  const response = await authenticatedFetch(`${apiBase}/errors?limit=100`);
  return readList(response, 'errors', applicationErrorSchema);
}

export async function reportFrontendError(input: {
  message: string;
  stack?: string;
  path: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    let response = await fetch(`${apiBase}/frontend-errors`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (response.status === 401) {
      const refresh = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/v1/auth/refresh`, {
        method: 'POST', credentials: 'include',
      });
      if (refresh.ok) {
        response = await fetch(`${apiBase}/frontend-errors`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
      }
    }
  } catch {
    // El registro de errores nunca debe generar otra excepción en el navegador.
  }
}
