import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';

// TODO: Implementar en Fase 3
export const reportsRouter = Router();

reportsRouter.use(authenticate);

reportsRouter.get('/health', (_req, res) => {
  res.json({ success: true, module: 'reports', status: 'stub - pendiente de implementación' });
});
