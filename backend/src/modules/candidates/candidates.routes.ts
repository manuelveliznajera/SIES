import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';

// TODO: Implementar en Fase 3
export const candidatesRouter = Router();

candidatesRouter.use(authenticate);

candidatesRouter.get('/health', (_req, res) => {
  res.json({ success: true, module: 'candidates', status: 'stub - pendiente de implementación' });
});
