import { z } from 'zod';
import type { InterviewRecord } from './App';

const answerSchema = z.object({
  questionId: z.string(),
  questionTitle: z.string(),
  answerText: z.string(),
});

const interviewSchema = z.object({
  id: z.string(),
  databaseId: z.string().optional(),
  deviceUuid: z.string().optional(),
  surveyId: z.string(),
  communityId: z.string().optional(),
  surveyTitle: z.string(),
  enumeratorAlias: z.string(),
  surveyNumber: z.number(),
  enumeratorName: z.string(),
  department: z.string(),
  municipality: z.string(),
  community: z.string(),
  ageGroup: z.string(),
  gender: z.string(),
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number(),
  timestamp: z.string(),
  startedAt: z.string().optional(),
  status: z.enum(['synced', 'pending']),
  answers: z.array(answerSchema),
});

const listResponseSchema = z.object({ success: z.literal(true), interviews: z.array(interviewSchema) });
const createResponseSchema = z.object({ success: z.literal(true), interview: z.object({ id: z.string(), duplicate: z.boolean() }) });

const apiBase = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

export interface InterviewWriteInput {
  deviceUuid: string;
  surveyId: string;
  communityId: string;
  folio: string;
  ageGroup: string;
  gender: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  startedAt: string;
  interviewedAt: string;
  answers: Array<{ questionId: string; answerText: string }>;
}

export interface ClearSurveyInterviewsResult {
  deletedCount: number;
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

export async function createInterview(input: InterviewWriteInput): Promise<string> {
  const response = await authenticatedFetch(`${apiBase}/interviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const result = await parseResponse(response, createResponseSchema);
  return result.interview.id;
}

export async function deleteInterview(interviewId: string): Promise<void> {
  const response = await authenticatedFetch(`${apiBase}/interviews/${encodeURIComponent(interviewId)}`, { method: 'DELETE' });
  await parseResponse(response, z.object({ success: z.literal(true), deleted: z.literal(true) }));
}

export async function clearSurveyInterviews(surveyId: string): Promise<ClearSurveyInterviewsResult> {
  const response = await authenticatedFetch(`${apiBase}/interviews/survey/${encodeURIComponent(surveyId)}`, { method: 'DELETE' });
  return parseResponse(response, z.object({ success: z.literal(true), deletedCount: z.number().int().nonnegative() }));
}
