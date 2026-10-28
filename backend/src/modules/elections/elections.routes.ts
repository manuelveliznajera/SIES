import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';

// TODO: Implementar en Fase 3
export const electionsRouter = Router();

electionsRouter.use(authenticate);

electionsRouter.get('/health', (_req, res) => {
  res.json({ success: true, module: 'elections', status: 'stub - pendiente de implementación' });
});
