import { z } from 'zod';
export declare const createUserSchema: z.ZodObject<{
    username: z.ZodString;
    email: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    role: z.ZodEnum<["ADMIN", "SUPERVISOR", "ENUMERATOR"]>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    fullName: string;
    password: string;
    email: string;
    phone: string;
    role: "ADMIN" | "ENUMERATOR" | "SUPERVISOR";
}, {
    username: string;
    fullName: string;
    password: string;
    email: string;
    role: "ADMIN" | "ENUMERATOR" | "SUPERVISOR";
    phone?: string | undefined;
}>;
export declare const updateUserSchema: z.ZodObject<{
    fullName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    role: z.ZodEnum<["ADMIN", "SUPERVISOR", "ENUMERATOR"]>;
    password: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fullName: string;
    email: string;
    phone: string;
    role: "ADMIN" | "ENUMERATOR" | "SUPERVISOR";
    password?: string | undefined;
}, {
    fullName: string;
    email: string;
    role: "ADMIN" | "ENUMERATOR" | "SUPERVISOR";
    password?: string | undefined;
    phone?: string | undefined;
}>;
export declare const userIdSchema: z.ZodString;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
//# sourceMappingURL=users.validators.d.ts.map