import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/authenticate';
import {
  createUser,
  activateUser,
  deactivateUser,
  listUsers,
  updateUser,
} from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.use(authorize(['ADMIN']));
usersRouter.get('/', listUsers);
usersRouter.post('/', createUser);
usersRouter.patch('/:id', updateUser);
usersRouter.patch('/:id/activate', activateUser);
usersRouter.delete('/:id', deactivateUser);
