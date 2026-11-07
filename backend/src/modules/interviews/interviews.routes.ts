import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import { clearSurveyInterviews, createInterview, deleteInterview, listInterviews } from './interviews.controller';

export const interviewsRouter = Router();

interviewsRouter.use(authenticate);
interviewsRouter.get('/', authorize(['ADMIN', 'SUPERVISOR', 'ENUMERATOR']), listInterviews);
interviewsRouter.post('/', authorize(['ADMIN', 'ENUMERATOR']), createInterview);
interviewsRouter.delete('/survey/:surveyId', authorize(['ADMIN']), clearSurveyInterviews);
interviewsRouter.delete('/:interviewId', authorize(['ADMIN']), deleteInterview);
