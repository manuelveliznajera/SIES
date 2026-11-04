import { z } from 'zod';
export declare const interviewIdSchema: z.ZodString;
export declare const interviewInputSchema: z.ZodEffects<z.ZodObject<{
    deviceUuid: z.ZodString;
    surveyId: z.ZodString;
    communityId: z.ZodString;
    folio: z.ZodString;
    ageGroup: z.ZodString;
    gender: z.ZodString;
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    accuracy: z.ZodNumber;
    interviewedAt: z.ZodString;
    answers: z.ZodArray<z.ZodObject<{
        questionId: z.ZodString;
        answerText: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        questionId: string;
        answerText: string;
    }, {
        questionId: string;
        answerText: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    surveyId: string;
    communityId: string;
    deviceUuid: string;
    folio: string;
    ageGroup: string;
    gender: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    interviewedAt: string;
    answers: {
        questionId: string;
        answerText: string;
    }[];
}, {
    surveyId: string;
    communityId: string;
    deviceUuid: string;
    folio: string;
    ageGroup: string;
    gender: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    interviewedAt: string;
    answers: {
        questionId: string;
        answerText: string;
    }[];
}>, {
    surveyId: string;
    communityId: string;
    deviceUuid: string;
    folio: string;
    ageGroup: string;
    gender: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    interviewedAt: string;
    answers: {
        questionId: string;
        answerText: string;
    }[];
}, {
    surveyId: string;
    communityId: string;
    deviceUuid: string;
    folio: string;
    ageGroup: string;
    gender: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    interviewedAt: string;
    answers: {
        questionId: string;
        answerText: string;
    }[];
}>;
export type InterviewInput = z.infer<typeof interviewInputSchema>;
//# sourceMappingURL=interviews.validators.d.ts.map