import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import { z } from 'zod';
import { assignmentsService } from './assignments.service';

// TODO: Implementar en Fase 3
export const assignmentsRouter = Router();

assignmentsRouter.use(authenticate);

assignmentsRouter.get('/health', (_req, res) => {
  res.json({ success: true, module: 'assignments', status: 'ready' });
});

assignmentsRouter.patch('/:surveyId/:communityId', authorize(['ADMIN']), async (req, res, next) => {
  try {
    const id = z.string().uuid();
    const surveyId = id.parse(req.params.surveyId);
    const communityId = id.parse(req.params.communityId);
    const input = z.object({ name: z.string().trim().min(1).max(150), assignedTo: z.string().trim().min(3).max(80), quota: z.number().int().min(0).max(1000000) }).parse(req.body);
    const result = await assignmentsService.reassign(surveyId, communityId, input.name, input.assignedTo, input.quota, req.user!.userId);
    const errors: Record<string, { status: number; message: string; code: string }> = {
      survey_missing: { status: 404, message: 'Estudio no encontrado.', code: 'SURVEY_NOT_FOUND' },
      survey_closed: { status: 409, message: 'No se pueden modificar asignaciones de un estudio cerrado.', code: 'SURVEY_CLOSED' },
      community_missing: { status: 404, message: 'La comunidad no pertenece a este estudio.', code: 'COMMUNITY_NOT_FOUND' },
      enumerator_missing: { status: 400, message: 'El encuestador no existe, está inactivo o no tiene asignado el rol correcto.', code: 'ENUMERATOR_NOT_AVAILABLE' },
      assignment_completed: { status: 409, message: 'Este encuestador ya completó la asignación de esta comunidad.', code: 'ASSIGNMENT_COMPLETED' },
      duplicate_community: { status: 409, message: 'Ya existe una comunidad con ese nombre en este estudio.', code: 'DUPLICATE_COMMUNITY' },
    };
    if (result.kind !== 'ok') {
      const error = errors[result.kind];
      res.status(error.status).json({ success: false, message: error.message, code: error.code });
      return;
    }
    res.json({ success: true, community: result.community });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Datos de asignación inválidos.', code: 'VALIDATION_ERROR' });
      return;
    }
    next(error);
  }
});

assignmentsRouter.post('/:surveyId', authorize(['ADMIN']), async (req, res, next) => {
  try {
    const surveyId = z.string().uuid().parse(req.params.surveyId);
    const input = z.object({ name: z.string().trim().min(1).max(150), assignedTo: z.string().trim().min(3).max(80), quota: z.number().int().min(0).max(1000000) }).parse(req.body);
    const result = await assignmentsService.create(surveyId, input.name, input.assignedTo, input.quota, req.user!.userId);
    const errors: Record<string, { status: number; message: string; code: string }> = {
      survey_missing: { status: 404, message: 'Estudio no encontrado.', code: 'SURVEY_NOT_FOUND' },
      survey_closed: { status: 409, message: 'No se pueden modificar comunidades de un estudio cerrado.', code: 'SURVEY_CLOSED' },
      enumerator_missing: { status: 400, message: 'El encuestador no existe, está inactivo o no tiene asignado el rol correcto.', code: 'ENUMERATOR_NOT_AVAILABLE' },
      duplicate_community: { status: 409, message: 'Ya existe una comunidad con ese nombre en este estudio.', code: 'DUPLICATE_COMMUNITY' },
    };
    if (result.kind !== 'ok') {
      const error = errors[result.kind];
      res.status(error.status).json({ success: false, message: error.message, code: error.code });
      return;
    }
    res.status(201).json({ success: true, community: { id: result.id, name: result.name, assignedTo: result.assignedTo, quota: result.quota } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Datos de comunidad inválidos.', code: 'VALIDATION_ERROR' });
      return;
    }
    next(error);
  }
});
