import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { logger } from './utils/logger';
import { generalRateLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Rutas
import { authRouter } from './modules/auth/auth.routes';
import { geographyRouter } from './modules/geography/geography.routes';
import { enumeratorsRouter } from './modules/enumerators/enumerators.routes';
import { surveysRouter } from './modules/surveys/surveys.routes';
import { electionsRouter } from './modules/elections/elections.routes';
import { candidatesRouter } from './modules/candidates/candidates.routes';
import { assignmentsRouter } from './modules/assignments/assignments.routes';
import { interviewsRouter } from './modules/interviews/interviews.routes';
import { syncRouter } from './modules/synchronization/sync.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { usersRouter } from './modules/users/users.routes';
import { adminLogsRouter } from './modules/adminLogs/adminLogs.routes';

export function createApp(): Application {
  const app = express();

  // ── Seguridad HTTP ──────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // ── CORS ────────────────────────────────────────────
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true, // Necesario para cookies httpOnly
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ── Parsers ─────────────────────────────────────────
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // ── Logging HTTP ────────────────────────────────────
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: () => env.NODE_ENV === 'test',
    })
  );

  // ── Rate limiting general ───────────────────────────
  app.use(`/api/${env.API_VERSION}`, generalRateLimiter);

  // ── Health check (no requiere autenticación) ────────
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: env.API_VERSION,
      environment: env.NODE_ENV,
    });
  });

  // ── Rutas de la API ─────────────────────────────────
  const apiBase = `/api/${env.API_VERSION}`;

  app.use(`${apiBase}/auth`, authRouter);
  app.use(`${apiBase}/users`, usersRouter);
  app.use(`${apiBase}/admin-logs`, adminLogsRouter);
  app.use(`${apiBase}/geography`, geographyRouter);
  app.use(`${apiBase}/enumerators`, enumeratorsRouter);
  app.use(`${apiBase}/surveys`, surveysRouter);
  app.use(`${apiBase}/elections`, electionsRouter);
  app.use(`${apiBase}/candidates`, candidatesRouter);
  app.use(`${apiBase}/assignments`, assignmentsRouter);
  app.use(`${apiBase}/interviews`, interviewsRouter);
  app.use(`${apiBase}/sync`, syncRouter);
  app.use(`${apiBase}/reports`, reportsRouter);

  // ── Manejadores de error ────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
