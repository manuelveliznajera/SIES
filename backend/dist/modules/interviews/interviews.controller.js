"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInterviews = listInterviews;
exports.createInterview = createInterview;
const zod_1 = require("zod");
const interviews_validators_1 = require("./interviews.validators");
const interviews_service_1 = require("./interviews.service");
const surveys_events_1 = require("../surveys/surveys.events");
const observability_1 = require("../../services/observability");
async function listInterviews(req, res, next) {
    try {
        const interviews = await interviews_service_1.interviewsService.list(req.user.userId, req.user.roles);
        res.status(200).json({ success: true, interviews });
    }
    catch (error) {
        next(error);
    }
}
async function createInterview(req, res, next) {
    try {
        const input = interviews_validators_1.interviewInputSchema.parse(req.body);
        const interview = await interviews_service_1.interviewsService.create(input, req.user.userId, req.user.roles);
        if (!interview.duplicate) {
            await (0, observability_1.writeAuditEvent)(req, {
                action: 'interview.created',
                entityType: 'interview',
                entityId: interview.id,
                changes: { folio: input.folio, surveyId: input.surveyId, communityId: input.communityId },
            });
            (0, surveys_events_1.publishInterviewCreated)({
                id: interview.id,
                folio: input.folio,
                surveyId: input.surveyId,
                createdAt: input.interviewedAt,
            });
        }
        res.status(201).json({ success: true, interview });
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            res.status(400).json({
                success: false,
                message: 'Los datos de la entrevista son inválidos.',
                code: 'VALIDATION_ERROR',
                errors: error.errors.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
            });
            return;
        }
        if (error instanceof interviews_service_1.InterviewSubmissionError) {
            res.status(error.status).json({ success: false, message: error.message, code: error.code });
            return;
        }
        next(error);
    }
}
//# sourceMappingURL=interviews.controller.js.map