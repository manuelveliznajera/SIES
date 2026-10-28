"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deactivateUser = deactivateUser;
exports.activateUser = activateUser;
const zod_1 = require("zod");
const logger_1 = require("../../utils/logger");
const users_validators_1 = require("./users.validators");
const users_service_1 = require("./users.service");
function sendError(error, next, res) {
    if (error instanceof zod_1.ZodError) {
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
async function listUsers(_req, res, next) {
    try {
        const users = await users_service_1.usersService.list();
        res.status(200).json({ success: true, users });
    }
    catch (error) {
        next(error);
    }
}
async function createUser(req, res, next) {
    try {
        const input = users_validators_1.createUserSchema.parse(req.body);
        const user = await users_service_1.usersService.create(input);
        res.status(201).json({ success: true, user });
    }
    catch (error) {
        sendError(error, next, res);
    }
}
async function updateUser(req, res, next) {
    try {
        const id = users_validators_1.userIdSchema.parse(req.params.id);
        const input = users_validators_1.updateUserSchema.parse(req.body);
        if (req.user?.userId === id && input.role !== 'ADMIN') {
            res.status(409).json({
                success: false,
                message: 'No puedes quitarte el rol de administrador desde tu propia sesión.',
                code: 'CANNOT_DEMOTE_SELF',
            });
            return;
        }
        const user = await users_service_1.usersService.update(id, input);
        if (!user) {
            res.status(404).json({ success: false, message: 'Usuario no encontrado.', code: 'USER_NOT_FOUND' });
            return;
        }
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        sendError(error, next, res);
    }
}
async function deactivateUser(req, res, next) {
    try {
        const id = users_validators_1.userIdSchema.parse(req.params.id);
        if (req.user?.userId === id) {
            res.status(409).json({
                success: false,
                message: 'No puedes desactivar tu propia cuenta desde esta sesión.',
                code: 'CANNOT_DEACTIVATE_SELF',
            });
            return;
        }
        const user = await users_service_1.usersService.deactivate(id);
        if (!user) {
            res.status(404).json({ success: false, message: 'Usuario no encontrado.', code: 'USER_NOT_FOUND' });
            return;
        }
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        if (error instanceof Error) {
            logger_1.logger.warn('No se pudo desactivar usuario', { error: error.message });
        }
        sendError(error, next, res);
    }
}
async function activateUser(req, res, next) {
    try {
        const id = users_validators_1.userIdSchema.parse(req.params.id);
        const user = await users_service_1.usersService.activate(id);
        if (!user) {
            res.status(404).json({ success: false, message: 'Usuario no encontrado.', code: 'USER_NOT_FOUND' });
            return;
        }
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=users.controller.js.map