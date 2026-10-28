import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import {
  archiveSurvey,
  createSurvey,
  listSurveys,
  updateSurvey,
} from './surveys.controller';

export const surveysRouter = Router();

surveysRouter.use(authenticate);
surveysRouter.get('/', listSurveys);
surveysRouter.post('/', authorize(['ADMIN']), createSurvey);
surveysRouter.patch('/:id', authorize(['ADMIN']), updateSurvey);
surveysRouter.delete('/:id', authorize(['ADMIN']), archiveSurvey);
