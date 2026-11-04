import type { InterviewInput } from './interviews.validators';
export declare class InterviewSubmissionError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(message: string, status: number, code: string);
}
export declare class InterviewsService {
    list(userId: string, roles: string[]): Promise<{
        id: string;
        surveyId: string;
        surveyTitle: string;
        enumeratorAlias: string;
        surveyNumber: number;
        enumeratorName: string;
        department: string;
        municipality: string;
        community: string;
        ageGroup: string;
        gender: string;
        lat: number;
        lng: number;
        accuracy: number;
        timestamp: string;
        status: "pending" | "synced";
        answers: {
            questionId: string;
            questionTitle: string;
            answerText: string;
        }[];
    }[]>;
    create(input: InterviewInput, userId: string, roles: string[]): Promise<{
        id: string;
        duplicate: boolean;
    }>;
}
export declare const interviewsService: InterviewsService;
//# sourceMappingURL=interviews.service.d.ts.map