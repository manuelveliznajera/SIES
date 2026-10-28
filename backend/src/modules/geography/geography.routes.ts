import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';

// TODO: Implementar en Fase 3
export const geographyRouter = Router();

geographyRouter.use(authenticate);

geographyRouter.get('/health', (_req, res) => {
  res.json({ success: true, module: 'geography', status: 'stub - pendiente de implementación' });
});
