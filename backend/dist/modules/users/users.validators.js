"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userIdSchema = exports.updateUserSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
const userRoleSchema = zod_1.z.enum(['ADMIN', 'SUPERVISOR', 'ENUMERATOR']);
exports.createUserSchema = zod_1.z.object({
    username: zod_1.z.string().trim().min(3).max(80),
    email: zod_1.z.string().trim().email().max(255),
    fullName: zod_1.z.string().trim().min(1).max(255),
    phone: zod_1.z.string().trim().max(30).optional().default(''),
    role: userRoleSchema,
    password: zod_1.z.string().min(12).max(128),
});
exports.updateUserSchema = zod_1.z.object({
    fullName: zod_1.z.string().trim().min(1).max(255),
    email: zod_1.z.string().trim().email().max(255),
    phone: zod_1.z.string().trim().max(30).optional().default(''),
    role: userRoleSchema,
    password: zod_1.z.string().min(12).max(128).optional(),
});
exports.userIdSchema = zod_1.z.string().uuid();
//# sourceMappingURL=users.validators.js.map