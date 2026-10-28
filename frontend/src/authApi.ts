import { z } from 'zod';

const authUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  roles: z.array(z.string()),
  enumeratorId: z.string().nullable(),
});

const authResponseSchema = z.object({
  success: z.literal(true),
  user: authUserSchema,
});

export type AuthenticatedSession = z.infer<typeof authUserSchema>;

const authUrl = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/auth`;
let currentSessionRequest: Promise<AuthenticatedSession | null> | null = null;

async function readAuthResponse(response: Response): Promise<AuthenticatedSession> {
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
        : 'No se pudo completar la solicitud de autenticación.';
    throw new Error(message);
  }

  const result = authResponseSchema.safeParse(payload);
  if (!result.success) {
    throw new Error('El servidor devolvió una respuesta de autenticación inválida.');
  }

  return result.data.user;
}

export async function login(identifier: string, password: string): Promise<AuthenticatedSession> {
  const response = await fetch(`${authUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identifier, password }),
  });

  return readAuthResponse(response);
}

export function getCurrentSession(): Promise<AuthenticatedSession | null> {
  // React StrictMode monta el componente dos veces en desarrollo. Compartir
  // la restauración evita rotar simultáneamente el mismo refresh token.
  if (currentSessionRequest) return currentSessionRequest;

  const request = (async (): Promise<AuthenticatedSession | null> => {
    const response = await fetch(`${authUrl}/me`, { credentials: 'include' });

    if (response.status === 401) {
      const refreshResponse = await fetch(`${authUrl}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshResponse.status === 401) return null;
      return readAuthResponse(refreshResponse);
    }

    return readAuthResponse(response);
  })();

  currentSessionRequest = request;
  void request.then(
    () => { if (currentSessionRequest === request) currentSessionRequest = null; },
    () => { if (currentSessionRequest === request) currentSessionRequest = null; }
  );
  return request;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${authUrl}/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    let message = 'No se pudo cerrar la sesión en el servidor.';
    try {
      const payload: unknown = await response.json();
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'message' in payload &&
        typeof payload.message === 'string'
      ) {
        message = payload.message;
      }
    } catch {
      // Mantener el mensaje predeterminado cuando la respuesta no contiene JSON.
    }
    throw new Error(message);
  }
}
