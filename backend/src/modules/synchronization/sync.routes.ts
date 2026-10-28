import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';

// TODO: Implementar en Fase 3
export const syncRouter = Router();

syncRouter.use(authenticate);

syncRouter.get('/health', (_req, res) => {
  res.json({ success: true, module: 'synchronization', status: 'stub - pendiente de implementación' });
});
