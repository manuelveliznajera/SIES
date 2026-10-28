"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSurveys = listSurveys;
exports.createSurvey = createSurvey;
exports.updateSurvey = updateSurvey;
exports.archiveSurvey = archiveSurvey;
const zod_1 = require("zod");
const surveys_validators_1 = require("./surveys.validators");
const surveys_service_1 = require("./surveys.service");
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
        res.status(200).json({ success: true, message: 'Encuesta archivada.' });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=surveys.controller.js.map