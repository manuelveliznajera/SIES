import type { SurveyInput } from './surveys.validators';
type QuestionType = SurveyInput['questions'][number]['type'];
export interface SurveyRecord {
    id: string;
    code: string;
    title: string;
    department: string;
    municipality: string;
    municipalities: Array<{
        municipality: string;
        quota: number;
    }>;
    communities: Array<{
        id: string;
        name: string;
        assignedTo: string;
        quota: number;
    }>;
    startDate: string;
    endDate: string;
    targetSample: number;
    status: 'active' | 'draft' | 'completed';
    questions: Array<{
        id: string;
        title: string;
        type: QuestionType;
        isRequired: boolean;
        options: Array<{
            id: string;
            text: string;
            color: string;
            votes: number;
            allowsOtherText: boolean;
        }>;
    }>;
    assignedEnumerators: string[];
    collectedSample: number;
}
export declare class SurveysService {
    list(userId: string, roles: string[]): Promise<SurveyRecord[]>;
    create(input: SurveyInput, userId: string): Promise<SurveyRecord>;
    update(surveyId: string, input: SurveyInput, userId: string): Promise<SurveyRecord | null>;
    archive(surveyId: string): Promise<boolean>;
    private ensureMunicipality;
    private saveVersion;
    private saveAssignments;
    private getById;
}
export declare const surveysService: SurveysService;
export {};
//# sourceMappingURL=surveys.service.d.ts.map