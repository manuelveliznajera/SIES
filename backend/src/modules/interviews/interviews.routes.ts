import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import { createInterview, listInterviews } from './interviews.controller';

export const interviewsRouter = Router();

interviewsRouter.use(authenticate);
interviewsRouter.get('/', authorize(['ADMIN', 'SUPERVISOR', 'ENUMERATOR']), listInterviews);
interviewsRouter.post('/', authorize(['ADMIN', 'ENUMERATOR']), createInterview);
