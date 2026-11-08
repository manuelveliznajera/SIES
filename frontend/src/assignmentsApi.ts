import { z } from 'zod';

const apiBase = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;
const successSchema = z.object({ success: z.literal(true), community: z.string() });
const createdSchema = z.object({ success: z.literal(true), community: z.object({ id: z.string(), name: z.string(), assignedTo: z.string(), quota: z.number() }) });
const quotaUpdatedSchema = z.object({ success: z.literal(true), quota: z.number(), status: z.string() });

async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const requestInit = { ...init, credentials: 'include' as const };
  const response = await fetch(url, requestInit);
  if (response.status !== 401) return response;
  const refresh = await fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' });
  return refresh.ok ? fetch(url, requestInit) : response;
}

export async function updateCommunityAssignment(
  surveyId: string,
  communityId: string,
  name: string,
  assignedTo: string,
  quota: number
): Promise<void> {
  const response = await authenticatedFetch(
    `${apiBase}/assignments/${encodeURIComponent(surveyId)}/${encodeURIComponent(communityId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, assignedTo, quota }),
    }
  );
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string'
      ? payload.message : 'No se pudo guardar la asignación.';
    throw new Error(message);
  }
  if (!successSchema.safeParse(payload).success) throw new Error('El servidor devolvió una respuesta de asignación inválida.');
}

export async function updateCommunityQuota(surveyId: string, communityId: string, quota: number): Promise<void> {
  const response = await authenticatedFetch(
    `${apiBase}/assignments/${encodeURIComponent(surveyId)}/${encodeURIComponent(communityId)}/quota`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quota }),
    }
  );
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string'
      ? payload.message : 'No se pudo actualizar la meta de la comunidad.';
    throw new Error(message);
  }
  if (!quotaUpdatedSchema.safeParse(payload).success) throw new Error('El servidor devolvió una respuesta de meta inválida.');
}

export async function createCommunityAssignment(
  surveyId: string,
  name: string,
  assignedTo: string,
  quota: number
): Promise<z.infer<typeof createdSchema>['community']> {
  const response = await authenticatedFetch(`${apiBase}/assignments/${encodeURIComponent(surveyId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, assignedTo, quota }),
  });
  let payload: unknown;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string'
      ? payload.message : 'No se pudo crear la comunidad.';
    throw new Error(message);
  }
  const result = createdSchema.safeParse(payload);
  if (!result.success) throw new Error('El servidor devolvió una respuesta de comunidad inválida.');
  return result.data.community;
}
