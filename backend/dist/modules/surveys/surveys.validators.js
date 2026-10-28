"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.surveyIdSchema = exports.surveyInputSchema = void 0;
const zod_1 = require("zod");
const questionTypeSchema = zod_1.z.enum(['single', 'multiple', 'rating', 'text']);
const surveyQuestionSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(2000),
    type: questionTypeSchema,
    isRequired: zod_1.z.boolean(),
    options: zod_1.z.array(zod_1.z.object({
        text: zod_1.z.string().trim().min(1).max(500),
        color: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        allowsOtherText: zod_1.z.boolean().optional(),
    })).max(100),
});
const communityAssignmentSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(150),
    assignedTo: zod_1.z.string().trim().min(3).max(80),
    quota: zod_1.z.number().int().min(0).max(1000000),
});
exports.surveyInputSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(255),
    department: zod_1.z.string().trim().min(1).max(100),
    municipality: zod_1.z.string().trim().min(1).max(100),
    targetSample: zod_1.z.number().int().min(0).max(10000000),
    startDate: zod_1.z.string().date().nullable(),
    endDate: zod_1.z.string().date().nullable(),
    status: zod_1.z.enum(['active', 'draft', 'completed']),
    questions: zod_1.z.array(surveyQuestionSchema).max(200),
    communities: zod_1.z.array(communityAssignmentSchema).max(1000),
}).refine(({ startDate, endDate }) => !startDate || !endDate || startDate <= endDate, { message: 'La fecha de inicio no puede ser posterior a la fecha límite.', path: ['endDate'] }).refine(({ communities }) => {
    const names = communities.map(({ name }) => name.toLocaleLowerCase());
    return new Set(names).size === names.length;
}, { message: 'No se puede repetir una comunidad en la misma encuesta.', path: ['communities'] });
exports.surveyIdSchema = zod_1.z.string().uuid();
//# sourceMappingURL=surveys.validators.js.map