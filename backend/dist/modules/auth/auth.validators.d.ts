import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    body: z.ZodObject<{
        identifier: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        identifier: string;
        password: string;
    }, {
        identifier: string;
        password: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        identifier: string;
        password: string;
    };
}, {
    body: {
        identifier: string;
        password: string;
    };
}>;
export declare const refreshSchema: z.ZodObject<{
    body: z.ZodObject<{
        refreshToken: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        refreshToken: string;
    }, {
        refreshToken: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        refreshToken: string;
    };
}, {
    body: {
        refreshToken: string;
    };
}>;
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshInput = z.infer<typeof refreshSchema>['body'];
//# sourceMappingURL=auth.validators.d.ts.map