import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { surveyIdSchema, surveyInputSchema } from './surveys.validators';
import { surveysService } from './surveys.service';
import {
  publishSurveyCreated,
  subscribeToInterviewCreated,
  subscribeToSurveyCreated,
} from './surveys.events';
import { writeAuditEvent } from '../../services/observability';

export function streamSurveyEvents(_req: Request, res: Response): void {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(': conexión SSE lista\n\n');

  const unsubscribe = subscribeToSurveyCreated((event) => {
    res.write(`event: survey.created\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const unsubscribeInterview = subscribeToInterviewCreated((event) => {
    res.write(`event: interview.created\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 25_000);

  res.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    unsubscribeInterview();
  });
}

function sendError(error: unknown, next: NextFunction, res: Response): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Datos de la encuesta inválidos.',
      code: 'VALIDATION_ERROR',
      errors: error.errors.map((item) => ({
        field: item.path.join('.'),
        message: item.message,
      })),
    });
    return;
  }
  if (error instanceof Error && error.message.startsWith('El encuestador @')) {
    res.status(400).json({ success: false, message: error.message, code: 'ENUMERATOR_NOT_AVAILABLE' });
    return;
  }
  next(error);
}

export async function listSurveys(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const surveys = await surveysService.list(req.user!.userId, req.user!.roles);
    res.status(200).json({ success: true, surveys });
  } catch (error) {
    next(error);
  }
}

export async function createSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = surveyInputSchema.parse(req.body);
    const survey = await surveysService.create(input, req.user!.userId);
    publishSurveyCreated({
      id: survey.id,
      title: survey.title,
      municipality: survey.municipality,
      createdAt: new Date().toISOString(),
    });
    await writeAuditEvent(req, {
      action: 'survey.created',
      entityType: 'survey',
      entityId: survey.id,
      changes: { title: survey.title, municipality: survey.municipality, status: survey.status },
    });
    res.status(201).json({ success: true, survey });
  } catch (error) {
    sendError(error, next, res);
  }
}

export async function updateSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = surveyIdSchema.parse(req.params.id);
    const input = surveyInputSchema.parse(req.body);
    const survey = await surveysService.update(id, input, req.user!.userId);
    if (!survey) {
      res.status(404).json({ success: false, message: 'Encuesta no encontrada.', code: 'SURVEY_NOT_FOUND' });
      return;
    }
    await writeAuditEvent(req, {
      action: 'survey.updated',
      entityType: 'survey',
      entityId: survey.id,
      changes: { title: survey.title, municipality: survey.municipality, status: survey.status },
    });
    res.status(200).json({ success: true, survey });
  } catch (error) {
    sendError(error, next, res);
  }
}

export async function archiveSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = surveyIdSchema.parse(req.params.id);
    const archived = await surveysService.archive(id);
    if (!archived) {
      res.status(404).json({ success: false, message: 'Encuesta no encontrada.', code: 'SURVEY_NOT_FOUND' });
      return;
    }
    await writeAuditEvent(req, {
      action: 'survey.archived',
      entityType: 'survey',
      entityId: id,
    });
    res.status(200).json({ success: true, message: 'Encuesta archivada.' });
  } catch (error) {
    next(error);
  }
}

export async function restoreSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = surveyIdSchema.parse(req.params.id);
    const survey = await surveysService.restore(id);
    if (!survey) {
      res.status(404).json({ success: false, message: 'Encuesta archivada no encontrada.', code: 'ARCHIVED_SURVEY_NOT_FOUND' });
      return;
    }
    await writeAuditEvent(req, {
      action: 'survey.restored',
      entityType: 'survey',
      entityId: survey.id,
      changes: { title: survey.title, municipality: survey.municipality },
    });
    res.status(200).json({ success: true, survey });
  } catch (error) {
    sendError(error, next, res);
  }
}
