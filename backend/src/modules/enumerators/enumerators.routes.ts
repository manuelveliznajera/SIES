import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';

// TODO: Implementar en Fase 3
export const enumeratorsRouter = Router();

enumeratorsRouter.use(authenticate);

enumeratorsRouter.get('/health', (_req, res) => {
  res.json({ success: true, module: 'enumerators', status: 'stub - pendiente de implementación' });
});
