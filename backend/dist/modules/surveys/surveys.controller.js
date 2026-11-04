"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamSurveyEvents = streamSurveyEvents;
exports.listSurveys = listSurveys;
exports.createSurvey = createSurvey;
exports.updateSurvey = updateSurvey;
exports.archiveSurvey = archiveSurvey;
exports.restoreSurvey = restoreSurvey;
const zod_1 = require("zod");
const surveys_validators_1 = require("./surveys.validators");
const surveys_service_1 = require("./surveys.service");
const surveys_events_1 = require("./surveys.events");
const observability_1 = require("../../services/observability");
function streamSurveyEvents(_req, res) {
    res.status(200);
    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(': conexión SSE lista\n\n');
    const unsubscribe = (0, surveys_events_1.subscribeToSurveyCreated)((event) => {
        res.write(`event: survey.created\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const unsubscribeInterview = (0, surveys_events_1.subscribeToInterviewCreated)((event) => {
        res.write(`event: interview.created\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => {
        res.write(': keep-alive\n\n');
    }, 25_000);
    res.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        unsubscribeInterview();
    });
}
function sendError(error, next, res) {
    if (error instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            message: 'Datos de la encuesta inválidos.',
            code: 'VALIDATION_ERROR',
            errors: error.errors.map((item) => ({
                field: item.path.join('.'),
                message: item.message,
            })),
        });
        return;
    }
    if (error instanceof Error && error.message.startsWith('El encuestador @')) {
        res.status(400).json({ success: false, message: error.message, code: 'ENUMERATOR_NOT_AVAILABLE' });
        return;
    }
    next(error);
}
async function listSurveys(req, res, next) {
    try {
        const surveys = await surveys_service_1.surveysService.list(req.user.userId, req.user.roles);
        res.status(200).json({ success: true, surveys });
    }
    catch (error) {
        next(error);
    }
}
async function createSurvey(req, res, next) {
    try {
        const input = surveys_validators_1.surveyInputSchema.parse(req.body);
        const survey = await surveys_service_1.surveysService.create(input, req.user.userId);
        (0, surveys_events_1.publishSurveyCreated)({
            id: survey.id,
            title: survey.title,
            municipality: survey.municipality,
            createdAt: new Date().toISOString(),
        });
        await (0, observability_1.writeAuditEvent)(req, {
            action: 'survey.created',
            entityType: 'survey',
            entityId: survey.id,
            changes: { title: survey.title, municipality: survey.municipality, status: survey.status },
        });
        res.status(201).json({ success: true, survey });
    }
    catch (error) {
        sendError(error, next, res);
    }
}
async function updateSurvey(req, res, next) {
    try {
        const id = surveys_validators_1.surveyIdSchema.parse(req.params.id);
        const input = surveys_validators_1.surveyInputSchema.parse(req.body);
        const survey = await surveys_service_1.surveysService.update(id, input, req.user.userId);
        if (!survey) {
            res.status(404).json({ success: false, message: 'Encuesta no encontrada.', code: 'SURVEY_NOT_FOUND' });
            return;
        }
        await (0, observability_1.writeAuditEvent)(req, {
            action: 'survey.updated',
            entityType: 'survey',
            entityId: survey.id,
            changes: { title: survey.title, municipality: survey.municipality, status: survey.status },
        });
        res.status(200).json({ success: true, survey });
    }
    catch (error) {
        sendError(error, next, res);
    }
}
async function archiveSurvey(req, res, next) {
    try {
        const id = surveys_validators_1.surveyIdSchema.parse(req.params.id);
        const archived = await surveys_service_1.surveysService.archive(id);
        if (!archived) {
            res.status(404).json({ success: false, message: 'Encuesta no encontrada.', code: 'SURVEY_NOT_FOUND' });
            return;
        }
        await (0, observability_1.writeAuditEvent)(req, {
            action: 'survey.archived',
            entityType: 'survey',
            entityId: id,
        });
        res.status(200).json({ success: true, message: 'Encuesta archivada.' });
    }
    catch (error) {
        next(error);
    }
}
async function restoreSurvey(req, res, next) {
    try {
        const id = surveys_validators_1.surveyIdSchema.parse(req.params.id);
        const survey = await surveys_service_1.surveysService.restore(id);
        if (!survey) {
            res.status(404).json({ success: false, message: 'Encuesta archivada no encontrada.', code: 'ARCHIVED_SURVEY_NOT_FOUND' });
            return;
        }
        await (0, observability_1.writeAuditEvent)(req, {
            action: 'survey.restored',
            entityType: 'survey',
            entityId: survey.id,
            changes: { title: survey.title, municipality: survey.municipality },
        });
        res.status(200).json({ success: true, survey });
    }
    catch (error) {
        sendError(error, next, res);
    }
}
//# sourceMappingURL=surveys.controller.js.map