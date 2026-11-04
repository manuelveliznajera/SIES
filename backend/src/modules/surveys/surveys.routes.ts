import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import {
  archiveSurvey,
  createSurvey,
  listSurveys,
  restoreSurvey,
  streamSurveyEvents,
  updateSurvey,
} from './surveys.controller';

export const surveysRouter = Router();

surveysRouter.use(authenticate);
surveysRouter.get('/events', authorize(['ADMIN', 'SUPERVISOR']), streamSurveyEvents);
surveysRouter.get('/', listSurveys);
surveysRouter.post('/', authorize(['ADMIN']), createSurvey);
surveysRouter.patch('/:id', authorize(['ADMIN']), updateSurvey);
surveysRouter.patch('/:id/restore', authorize(['ADMIN']), restoreSurvey);
surveysRouter.delete('/:id', authorize(['ADMIN']), archiveSurvey);
