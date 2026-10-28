import { z } from 'zod';

const questionTypeSchema = z.enum(['single', 'multiple', 'rating', 'text']);

const surveyQuestionSchema = z.object({
  title: z.string().trim().min(1).max(2000),
  type: questionTypeSchema,
  isRequired: z.boolean(),
  options: z.array(z.object({
    text: z.string().trim().min(1).max(500),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    allowsOtherText: z.boolean().optional(),
  })).max(100),
});

const communityAssignmentSchema = z.object({
  name: z.string().trim().min(1).max(150),
  assignedTo: z.string().trim().min(3).max(80),
  quota: z.number().int().min(0).max(1000000),
});

export const surveyInputSchema = z.object({
  title: z.string().trim().min(1).max(255),
  department: z.string().trim().min(1).max(100),
  municipality: z.string().trim().min(1).max(100),
  targetSample: z.number().int().min(0).max(10000000),
  startDate: z.string().date().nullable(),
  endDate: z.string().date().nullable(),
  status: z.enum(['active', 'draft', 'completed']),
  questions: z.array(surveyQuestionSchema).max(200),
  communities: z.array(communityAssignmentSchema).max(1000),
}).refine(
  ({ startDate, endDate }) => !startDate || !endDate || startDate <= endDate,
  { message: 'La fecha de inicio no puede ser posterior a la fecha límite.', path: ['endDate'] }
).refine(
  ({ communities }) => {
    const names = communities.map(({ name }) => name.toLocaleLowerCase());
    return new Set(names).size === names.length;
  },
  { message: 'No se puede repetir una comunidad en la misma encuesta.', path: ['communities'] }
);

export const surveyIdSchema = z.string().uuid();

export type SurveyInput = z.infer<typeof surveyInputSchema>;
