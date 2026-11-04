import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger';
import { createUserSchema, updateUserSchema, userIdSchema } from './users.validators';
import { usersService } from './users.service';
import { writeAuditEvent } from '../../services/observability';

function sendError(error: unknown, next: NextFunction, res: Response): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Datos de usuario inválidos.',
      code: 'VALIDATION_ERROR',
      errors: error.errors.map((item) => ({
        field: item.path.join('.'),
        message: item.message,
      })),
    });
    return;
  }
  if (error instanceof Error && error.message === 'Debe permanecer al menos un administrador activo.') {
    res.status(409).json({ success: false, message: error.message, code: 'LAST_ACTIVE_ADMIN' });
    return;
  }
  next(error);
}

export async function listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await usersService.list();
    res.status(200).json({ success: true, users });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createUserSchema.parse(req.body);
    const user = await usersService.create(input);
    await writeAuditEvent(req, {
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      changes: { username: user.username, fullName: user.fullName, role: user.role },
    });
    res.status(201).json({ success: true, user });
  } catch (error) {
    sendError(error, next, res);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = userIdSchema.parse(req.params.id);
    const input = updateUserSchema.parse(req.body);
    if (req.user?.userId === id && input.role !== 'ADMIN') {
      res.status(409).json({
        success: false,
        message: 'No puedes quitarte el rol de administrador desde tu propia sesión.',
        code: 'CANNOT_DEMOTE_SELF',
      });
      return;
    }
    const user = await usersService.update(id, input);
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado.', code: 'USER_NOT_FOUND' });
      return;
    }
    await writeAuditEvent(req, {
      action: 'user.updated',
      entityType: 'user',
      entityId: user.id,
      changes: {
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        passwordChanged: Boolean(input.password),
      },
    });
    res.status(200).json({ success: true, user });
  } catch (error) {
    sendError(error, next, res);
  }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = userIdSchema.parse(req.params.id);
    if (req.user?.userId === id) {
      res.status(409).json({
        success: false,
        message: 'No puedes desactivar tu propia cuenta desde esta sesión.',
        code: 'CANNOT_DEACTIVATE_SELF',
      });
      return;
    }
    const user = await usersService.deactivate(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado.', code: 'USER_NOT_FOUND' });
      return;
    }
    await writeAuditEvent(req, {
      action: 'user.deactivated',
      entityType: 'user',
      entityId: user.id,
      changes: { username: user.username },
    });
    res.status(200).json({ success: true, user });
  } catch (error) {
    if (error instanceof Error) {
      logger.warn('No se pudo desactivar usuario', { error: error.message });
    }
    sendError(error, next, res);
  }
}

export async function activateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = userIdSchema.parse(req.params.id);
    const user = await usersService.activate(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado.', code: 'USER_NOT_FOUND' });
      return;
    }
    await writeAuditEvent(req, {
      action: 'user.activated',
      entityType: 'user',
      entityId: user.id,
      changes: { username: user.username },
    });
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
}
