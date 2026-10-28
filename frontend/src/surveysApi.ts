import { z } from 'zod';

const surveySchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  department: z.string(),
  municipality: z.string(),
  municipalities: z.array(z.object({ municipality: z.string(), quota: z.number() })),
  communities: z.array(z.object({
    id: z.string(),
    name: z.string(),
    assignedTo: z.string(),
    quota: z.number(),
  })),
  startDate: z.string(),
  endDate: z.string(),
  targetSample: z.number(),
  status: z.enum(['active', 'draft', 'completed']),
  questions: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(['single', 'multiple', 'rating', 'text']),
    isRequired: z.boolean(),
    options: z.array(z.object({
      id: z.string(),
      text: z.string(),
      color: z.string(),
      votes: z.number(),
      allowsOtherText: z.boolean(),
    })),
  })),
  assignedEnumerators: z.array(z.string()),
  collectedSample: z.number(),
});

const surveysResponseSchema = z.object({ success: z.literal(true), surveys: z.array(surveySchema) });
const surveyResponseSchema = z.object({ success: z.literal(true), survey: surveySchema });
const successResponseSchema = z.object({ success: z.literal(true) });

const apiBase = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

interface SurveyWriteInput {
  title: string;
  department: string;
  municipality: string;
  targetSample: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'draft' | 'completed';
  questions: Array<{
    title: string;
    type: 'single' | 'multiple' | 'rating' | 'text';
    isRequired: boolean;
    options: Array<{ text: string; color?: string; allowsOtherText?: boolean }>;
  }>;
  communities: Array<{ name: string; assignedTo: string; quota: number }>;
}

async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const requestInit = { ...init, credentials: 'include' as const };
  const response = await fetch(url, requestInit);
  if (response.status !== 401) return response;

  const refresh = await fetch(`${apiBase}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
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
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : 'No se pudo completar la solicitud de encuestas.';
    throw new Error(message);
  }
  const result = schema.safeParse(payload);
  if (!result.success) throw new Error('El servidor devolvió una respuesta de encuestas inválida.');
  return result.data;
}

function toSurveyInput(survey: SurveyWriteInput) {
  return {
    title: survey.title,
    department: survey.department,
    municipality: survey.municipality,
    targetSample: survey.targetSample,
    startDate: survey.startDate || null,
    endDate: survey.endDate || null,
    status: survey.status,
    questions: survey.questions.map((question) => ({
      title: question.title,
      type: question.type,
      isRequired: question.isRequired,
      options: question.options.map((option) => ({
        text: option.text,
        color: option.color,
        allowsOtherText: option.allowsOtherText ?? false,
      })),
    })),
    communities: survey.communities.map((community) => ({
      name: community.name,
      assignedTo: community.assignedTo,
      quota: community.quota,
    })),
  };
}

export async function listSurveys(): Promise<z.infer<typeof surveySchema>[]> {
  const response = await authenticatedFetch(`${apiBase}/surveys`);
  const payload = await parseResponse(response, surveysResponseSchema);
  return payload.surveys;
}

export async function createSurvey(
  survey: SurveyWriteInput
): Promise<z.infer<typeof surveySchema>> {
  const response = await authenticatedFetch(`${apiBase}/surveys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toSurveyInput(survey)),
  });
  const payload = await parseResponse(response, surveyResponseSchema);
  return payload.survey;
}

export async function updateSurvey(
  id: string,
  survey: SurveyWriteInput
): Promise<z.infer<typeof surveySchema>> {
  const response = await authenticatedFetch(`${apiBase}/surveys/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toSurveyInput(survey)),
  });
  const payload = await parseResponse(response, surveyResponseSchema);
  return payload.survey;
}

export async function archiveSurvey(id: string): Promise<void> {
  const response = await authenticatedFetch(`${apiBase}/surveys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await parseResponse(response, successResponseSchema);
}
