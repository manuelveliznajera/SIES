import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import { listApplicationErrors, listAuditEvents, reportFrontendError } from './adminLogs.controller';

export const adminLogsRouter = Router();
adminLogsRouter.use(authenticate);
adminLogsRouter.post('/frontend-errors', reportFrontendError);
adminLogsRouter.get('/audit', authorize(['ADMIN']), listAuditEvents);
adminLogsRouter.get('/errors', authorize(['ADMIN']), listApplicationErrors);
