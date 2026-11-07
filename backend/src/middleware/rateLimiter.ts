import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Rate limiter general para toda la API.
 * Límite: 100 peticiones por ventana de 15 minutos (configurable por env).
 */
export const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  // Los envíos de entrevistas tienen un límite propio por usuario autenticado.
  // Excluirlos evita que un proxy compartido agote el cupo general de todos los encuestadores.
  skip: (req) => (req.method === 'POST' && req.path.endsWith('/interviews')) || env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Demasiadas solicitudes. Por favor intenta nuevamente en unos minutos.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/** Limita envíos repetidos de entrevistas por cuenta, no por IP compartida del hosting. */
export const interviewCreationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user!.userId,
  message: {
    success: false,
    message: 'Se alcanzó el límite temporal de encuestas para este usuario. Intenta nuevamente más tarde.',
    code: 'INTERVIEW_RATE_LIMIT_EXCEEDED',
  },
  skip: () => env.NODE_ENV === 'test',
});

/**
 * Rate limiter para sincronización (más permisivo).
 * Los encuestadores pueden sincronizar varias veces en poco tiempo.
 */
export const syncRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas solicitudes de sincronización. Por favor espera un momento.',
    code: 'SYNC_RATE_LIMIT_EXCEEDED',
  },
  skip: () => env.NODE_ENV === 'test',
});
