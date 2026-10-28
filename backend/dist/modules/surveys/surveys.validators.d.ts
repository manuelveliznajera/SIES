import { z } from 'zod';
export declare const surveyInputSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    title: z.ZodString;
    department: z.ZodString;
    municipality: z.ZodString;
    targetSample: z.ZodNumber;
    startDate: z.ZodNullable<z.ZodString>;
    endDate: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["active", "draft", "completed"]>;
    questions: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        type: z.ZodEnum<["single", "multiple", "rating", "text"]>;
        isRequired: z.ZodBoolean;
        options: z.ZodArray<z.ZodObject<{
            text: z.ZodString;
            color: z.ZodOptional<z.ZodString>;
            allowsOtherText: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            color?: string | undefined;
            allowsOtherText?: boolean | undefined;
        }, {
            text: string;
            color?: string | undefined;
            allowsOtherText?: boolean | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        options: {
            text: string;
            color?: string | undefined;
            allowsOtherText?: boolean | undefined;
        }[];
        type: "single" | "multiple" | "rating" | "text";
        title: string;
        isRequired: boolean;
    }, {
        options: {
            text: string;
            color?: string | undefined;
            allowsOtherText?: boolean | undefined;
        }[];
        type: "single" | "multiple" | "rating" | "text";
        title: string;
        isRequired: boolean;
    }>, "many">;
    communities: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        assignedTo: z.ZodString;
        quota: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        assignedTo: string;
        quota: number;
    }, {
        name: string;
        assignedTo: string;
        quota: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "active" | "draft" | "completed";
    title: string;
    department: string;
    municipality: string;
    targetSample: number;
    startDate: string | null;
    endDate: string | null;
    questions: {
        options: {
            text: string;
            color?: string | undefined;
            allowsOtherText?: boolean | undefined;
        }[];
        type: "single" | "multiple" | "rating" | "text";
        title: string;
        isRequired: boolean;
    }[];
    communities: {
        name: string;
        assignedTo: string;
        quota: number;
    }[];
}, {
    status: "active" | "draft" | "completed";
    title: string;
    department: string;
    municipality: string;
    targetSample: number;
    startDate: string | null;
    endDate: string | null;
    questions: {
        options: {
            text: string;
            color?: string | undefined;
            allowsOtherText?: boolean | undefined;
        }[];
        type: "single" | "multiple" | "rating" | "text";
        title: string;
        isRequired: boolean;
    }[];
    communities: {
        name: string;
        assignedTo: string;
        quota: number;
    }[];
}>, {
    status: "active" | "draft" | "completed";
    title: string;
    department: string;
    municipality: string;
    targetSample: number;
    startDate: string | null;
    endDate: string | null;
    questions: {
        options: {
            text: string;
            color?: string | undefined;
            allowsOtherText?: boolean | undefined;
        }[];
        type: "single" | "multiple" | "rating" | "text";
        title: string;
        isRequired: boolean;
    }[];
    communities: {
        name: string;
        assignedTo: string;
        quota: number;
    }[];
}, {
    status: "active" | "draft" | "completed";
    title: string;
    department: string;
    municipality: string;
    targetSample: number;
    startDate: string | null;
    endDate: string | null;
    questions: {
        options: {
            text: string;
            color?: string | undefined;
            allowsOtherText?: boolean | undefined;
        }[];
        type: "single" | "multiple" | "rating" | "text";
        title: string;
        isRequired: boolean;
    }[];
    communities: {
        name: string;
        assignedTo: string;
        quota: number;
    }[];
}>, {
    status: "active" | "draft" | "completed";
    title: string;
    department: string;
    municipality: string;
    targetSample: number;
    startDate: string | null;
    endDate: string | null;
    questions: {
        options: {
            text: string;
            color?: string | undefined;
            allowsOtherText?: boolean | undefined;
        }[];
        type: "single" | "multiple" | "rating" | "text";
        title: string;
        isRequired: boolean;
    }[];
    communities: {
        name: string;
        assignedTo: string;
        quota: number;
    }[];
}, {
    status: "active" | "draft" | "completed";
    title: string;
    department: string;
    municipality: string;
    targetSample: number;
    startDate: string | null;
    endDate: string | null;
    questions: {
        options: {
            text: string;
            color?: string | undefined;
            allowsOtherText?: boolean | undefined;
        }[];
        type: "single" | "multiple" | "rating" | "text";
        title: string;
        isRequired: boolean;
    }[];
    communities: {
        name: string;
        assignedTo: string;
        quota: number;
    }[];
}>;
export declare const surveyIdSchema: z.ZodString;
export type SurveyInput = z.infer<typeof surveyInputSchema>;
//# sourceMappingURL=surveys.validators.d.ts.map