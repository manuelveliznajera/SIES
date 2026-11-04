"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentsRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
const zod_1 = require("zod");
const assignments_service_1 = require("./assignments.service");
// TODO: Implementar en Fase 3
exports.assignmentsRouter = (0, express_1.Router)();
exports.assignmentsRouter.use(authenticate_1.authenticate);
exports.assignmentsRouter.get('/health', (_req, res) => {
    res.json({ success: true, module: 'assignments', status: 'ready' });
});
exports.assignmentsRouter.patch('/:surveyId/:communityId', (0, authenticate_1.authorize)(['ADMIN']), async (req, res, next) => {
    try {
        const id = zod_1.z.string().uuid();
        const surveyId = id.parse(req.params.surveyId);
        const communityId = id.parse(req.params.communityId);
        const input = zod_1.z.object({ name: zod_1.z.string().trim().min(1).max(150), assignedTo: zod_1.z.string().trim().min(3).max(80), quota: zod_1.z.number().int().min(0).max(1000000) }).parse(req.body);
        const result = await assignments_service_1.assignmentsService.reassign(surveyId, communityId, input.name, input.assignedTo, input.quota, req.user.userId);
        const errors = {
            survey_missing: { status: 404, message: 'Estudio no encontrado.', code: 'SURVEY_NOT_FOUND' },
            survey_closed: { status: 409, message: 'No se pueden modificar asignaciones de un estudio cerrado.', code: 'SURVEY_CLOSED' },
            community_missing: { status: 404, message: 'La comunidad no pertenece a este estudio.', code: 'COMMUNITY_NOT_FOUND' },
            enumerator_missing: { status: 400, message: 'El encuestador no existe, está inactivo o no tiene asignado el rol correcto.', code: 'ENUMERATOR_NOT_AVAILABLE' },
            assignment_completed: { status: 409, message: 'Este encuestador ya completó la asignación de esta comunidad.', code: 'ASSIGNMENT_COMPLETED' },
            duplicate_community: { status: 409, message: 'Ya existe una comunidad con ese nombre en este estudio.', code: 'DUPLICATE_COMMUNITY' },
        };
        if (result.kind !== 'ok') {
            const error = errors[result.kind];
            res.status(error.status).json({ success: false, message: error.message, code: error.code });
            return;
        }
        res.json({ success: true, community: result.community });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, message: 'Datos de asignación inválidos.', code: 'VALIDATION_ERROR' });
            return;
        }
        next(error);
    }
});
exports.assignmentsRouter.post('/:surveyId', (0, authenticate_1.authorize)(['ADMIN']), async (req, res, next) => {
    try {
        const surveyId = zod_1.z.string().uuid().parse(req.params.surveyId);
        const input = zod_1.z.object({ name: zod_1.z.string().trim().min(1).max(150), assignedTo: zod_1.z.string().trim().min(3).max(80), quota: zod_1.z.number().int().min(0).max(1000000) }).parse(req.body);
        const result = await assignments_service_1.assignmentsService.create(surveyId, input.name, input.assignedTo, input.quota, req.user.userId);
        const errors = {
            survey_missing: { status: 404, message: 'Estudio no encontrado.', code: 'SURVEY_NOT_FOUND' },
            survey_closed: { status: 409, message: 'No se pueden modificar comunidades de un estudio cerrado.', code: 'SURVEY_CLOSED' },
            enumerator_missing: { status: 400, message: 'El encuestador no existe, está inactivo o no tiene asignado el rol correcto.', code: 'ENUMERATOR_NOT_AVAILABLE' },
            duplicate_community: { status: 409, message: 'Ya existe una comunidad con ese nombre en este estudio.', code: 'DUPLICATE_COMMUNITY' },
        };
        if (result.kind !== 'ok') {
            const error = errors[result.kind];
            res.status(error.status).json({ success: false, message: error.message, code: error.code });
            return;
        }
        res.status(201).json({ success: true, community: { id: result.id, name: result.name, assignedTo: result.assignedTo, quota: result.quota } });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ success: false, message: 'Datos de comunidad inválidos.', code: 'VALIDATION_ERROR' });
            return;
        }
        next(error);
    }
});
//# sourceMappingURL=assignments.routes.js.map