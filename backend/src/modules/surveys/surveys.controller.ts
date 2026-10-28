import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { surveyIdSchema, surveyInputSchema } from './surveys.validators';
import { surveysService } from './surveys.service';

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
    res.status(200).json({ success: true, message: 'Encuesta archivada.' });
  } catch (error) {
    next(error);
  }
}
