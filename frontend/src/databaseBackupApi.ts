const apiBase = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

async function authenticatedFetch(url = `${apiBase}/database-backup`, init: RequestInit = {}): Promise<Response> {
  const request = { ...init, credentials: 'include' as const };
  const response = await fetch(url, request);
  if (response.status !== 401) return response;
  const refresh = await fetch(`${apiBase}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!refresh.ok) return response;
  return fetch(url, request);
}

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string') return payload.message;
  } catch {
    // Mantener el mensaje genérico si el servidor o el proxy no devuelve JSON.
  }
  return fallback;
}

export async function downloadDatabaseBackup(includeUsers = false): Promise<void> {
  const response = await authenticatedFetch(includeUsers ? `${apiBase}/database-backup/full` : `${apiBase}/database-backup`);
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'No se pudo generar el respaldo de la base de datos.'));
  }
  const backup = await response.blob();
  const date = new Date().toISOString().slice(0, 10);
  const objectUrl = URL.createObjectURL(backup);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `sies-database-${includeUsers ? 'full-' : ''}backup-${date}.sql`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function resetDatabaseData(): Promise<{ clearedTableCount: number }> {
  const response = await authenticatedFetch(`${apiBase}/database-backup/reset`, { method: 'POST' });
  if (!response.ok) throw new Error(await getErrorMessage(response, 'No se pudo limpiar la base de datos.'));
  const payload = await response.json() as { success?: boolean; clearedTableCount?: number };
  if (!payload.success || typeof payload.clearedTableCount !== 'number') throw new Error('El servidor devolvió una respuesta de limpieza inválida.');
  return { clearedTableCount: payload.clearedTableCount };
}

export async function restoreDatabaseBackup(file: File): Promise<{ restoredStatementCount: number; includesUsers: boolean }> {
  const response = await authenticatedFetch(`${apiBase}/database-backup/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sql' },
    body: await file.text(),
  });
  if (!response.ok) throw new Error(await getErrorMessage(response, 'No se pudo restaurar el respaldo.'));
  const payload = await response.json() as { success?: boolean; restoredStatementCount?: number; includesUsers?: boolean };
  if (!payload.success || typeof payload.restoredStatementCount !== 'number') throw new Error('El servidor devolvió una respuesta de restauración inválida.');
  return { restoredStatementCount: payload.restoredStatementCount, includesUsers: payload.includesUsers === true };
}
