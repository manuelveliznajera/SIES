export interface SurveyCreatedEvent {
    id: string;
    title: string;
    municipality: string;
    createdAt: string;
}
export interface InterviewCreatedEvent {
    id: string;
    folio: string;
    surveyId: string;
    createdAt: string;
}
export declare function publishSurveyCreated(event: SurveyCreatedEvent): void;
export declare function subscribeToSurveyCreated(listener: (event: SurveyCreatedEvent) => void): () => void;
export declare function publishInterviewCreated(event: InterviewCreatedEvent): void;
export declare function subscribeToInterviewCreated(listener: (event: InterviewCreatedEvent) => void): () => void;
//# sourceMappingURL=surveys.events.d.ts.map