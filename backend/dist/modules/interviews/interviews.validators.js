"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewInputSchema = exports.interviewIdSchema = void 0;
const zod_1 = require("zod");
exports.interviewIdSchema = zod_1.z.string().uuid();
exports.interviewInputSchema = zod_1.z.object({
    deviceUuid: zod_1.z.string().uuid(),
    surveyId: zod_1.z.string().uuid(),
    communityId: zod_1.z.string().uuid(),
    folio: zod_1.z.string().trim().min(1).max(80),
    ageGroup: zod_1.z.string().trim().max(50),
    gender: zod_1.z.string().trim().max(50),
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
    accuracy: zod_1.z.number().min(0).max(100000),
    interviewedAt: zod_1.z.string().datetime(),
    answers: zod_1.z.array(zod_1.z.object({
        questionId: zod_1.z.string().uuid(),
        answerText: zod_1.z.string().max(10000),
    })).max(200),
}).superRefine((input, ctx) => {
    const questionIds = input.answers.map((answer) => answer.questionId);
    if (new Set(questionIds).size !== questionIds.length) {
        ctx.addIssue({ code: 'custom', message: 'No se puede repetir una respuesta para la misma pregunta.', path: ['answers'] });
    }
});
//# sourceMappingURL=interviews.validators.js.map