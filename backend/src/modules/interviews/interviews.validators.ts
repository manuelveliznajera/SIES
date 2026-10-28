import { z } from 'zod';

export const interviewIdSchema = z.string().uuid();

export const interviewInputSchema = z.object({
  deviceUuid: z.string().uuid(),
  surveyId: z.string().uuid(),
  communityId: z.string().uuid(),
  folio: z.string().trim().min(1).max(80),
  ageGroup: z.string().trim().max(50),
  gender: z.string().trim().max(50),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000),
  interviewedAt: z.string().datetime(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    answerText: z.string().max(10000),
  })).max(200),
}).superRefine((input, ctx) => {
  const questionIds = input.answers.map((answer) => answer.questionId);
  if (new Set(questionIds).size !== questionIds.length) {
    ctx.addIssue({ code: 'custom', message: 'No se puede repetir una respuesta para la misma pregunta.', path: ['answers'] });
  }
});

export type InterviewInput = z.infer<typeof interviewInputSchema>;
