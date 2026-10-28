import { z } from 'zod';

const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'ENUMERATOR']),
  isActive: z.boolean(),
  createdAt: z.string(),
});

const userResponseSchema = z.object({ success: z.literal(true), user: userSchema });
const usersResponseSchema = z.object({ success: z.literal(true), users: z.array(userSchema) });

export type UserRole = 'admin' | 'encuestador' | 'supervisor';
export interface AppUser {
  id: string;
  alias: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface UserInput {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
}

const apiBase = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/users`;
const authBase = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/auth`;

async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const requestInit = { ...init, credentials: 'include' as const };
  const response = await fetch(url, requestInit);
  if (response.status !== 401) return response;

  const refresh = await fetch(`${authBase}/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!refresh.ok) return response;
  return fetch(url, requestInit);
}

function mapUser(user: z.infer<typeof userSchema>): AppUser {
  return {
    id: user.id,
    alias: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || undefined,
    role: user.role === 'ADMIN' ? 'admin' : user.role === 'SUPERVISOR' ? 'supervisor' : 'encuestador',
    status: user.isActive ? 'active' : 'inactive',
    createdAt: user.createdAt,
  };
}

async function parseResponse<T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<T> {
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
        : 'No se pudo completar la solicitud de usuarios.';
    throw new Error(message);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error('El servidor devolvió una respuesta de usuarios inválida.');
  return parsed.data;
}

function toApiRole(role: UserRole): 'ADMIN' | 'SUPERVISOR' | 'ENUMERATOR' {
  return role === 'admin' ? 'ADMIN' : role === 'supervisor' ? 'SUPERVISOR' : 'ENUMERATOR';
}

export async function listUsers(): Promise<AppUser[]> {
  const response = await authenticatedFetch(apiBase);
  const payload = await parseResponse(response, usersResponseSchema);
  return payload.users.map(mapUser);
}

export async function createUser(input: UserInput & { alias: string; password: string }): Promise<AppUser> {
  const response = await authenticatedFetch(apiBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: input.alias,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      role: toApiRole(input.role),
      password: input.password,
    }),
  });
  const payload = await parseResponse(response, userResponseSchema);
  return mapUser(payload.user);
}

export async function updateUser(
  id: string,
  input: UserInput & { password?: string }
): Promise<AppUser> {
  const response = await authenticatedFetch(`${apiBase}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      role: toApiRole(input.role),
      ...(input.password ? { password: input.password } : {}),
    }),
  });
  const payload = await parseResponse(response, userResponseSchema);
  return mapUser(payload.user);
}

export async function deactivateUser(id: string): Promise<AppUser> {
  const response = await authenticatedFetch(`${apiBase}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const payload = await parseResponse(response, userResponseSchema);
  return mapUser(payload.user);
}

export async function activateUser(id: string): Promise<AppUser> {
  const response = await authenticatedFetch(`${apiBase}/${encodeURIComponent(id)}/activate`, {
    method: 'PATCH',
  });
  const payload = await parseResponse(response, userResponseSchema);
  return mapUser(payload.user);
}
