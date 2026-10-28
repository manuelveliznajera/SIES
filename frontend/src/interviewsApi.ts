import { z } from 'zod';
import type { InterviewRecord } from './App';

const answerSchema = z.object({
  questionId: z.string(),
  questionTitle: z.string(),
  answerText: z.string(),
});

const interviewSchema = z.object({
  id: z.string(),
  surveyId: z.string(),
  surveyTitle: z.string(),
  enumeratorAlias: z.string(),
  surveyNumber: z.number(),
  department: z.string(),
  municipality: z.string(),
  community: z.string(),
  ageGroup: z.string(),
  gender: z.string(),
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number(),
  timestamp: z.string(),
  status: z.enum(['synced', 'pending']),
  answers: z.array(answerSchema),
});

const listResponseSchema = z.object({ success: z.literal(true), interviews: z.array(interviewSchema) });
const createResponseSchema = z.object({ success: z.literal(true), interview: z.object({ id: z.string(), duplicate: z.boolean() }) });

const apiBase = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

interface InterviewWriteInput {
  deviceUuid: string;
  surveyId: string;
  communityId: string;
  folio: string;
  ageGroup: string;
  gender: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  interviewedAt: string;
  answers: Array<{ questionId: string; answerText: string }>;
}

async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const requestInit = { ...init, credentials: 'include' as const };
  const response = await fetch(url, requestInit);
  if (response.status !== 401) return response;

  const refresh = await fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!refresh.ok) return response;
  return fetch(url, requestInit);
}

async function parseResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : 'No se pudo completar la solicitud de entrevistas.';
    throw new Error(message);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error('El servidor devolvió una respuesta de entrevistas inválida.');
  return parsed.data;
}

export async function listInterviews(): Promise<InterviewRecord[]> {
  const response = await authenticatedFetch(`${apiBase}/interviews`);
  const payload = await parseResponse(response, listResponseSchema);
  return payload.interviews;
}

export async function createInterview(input: InterviewWriteInput): Promise<void> {
  const response = await authenticatedFetch(`${apiBase}/interviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  await parseResponse(response, createResponseSchema);
}
