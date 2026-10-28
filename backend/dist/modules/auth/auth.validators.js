"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        identifier: zod_1.z
            .string()
            .min(3, 'El usuario o correo es obligatorio')
            .max(255)
            .trim(),
        password: zod_1.z
            .string()
            .min(1, 'La contraseña es obligatoria')
            .max(128, 'Contraseña demasiado larga'),
    }),
});
exports.refreshSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().min(1, 'El refresh token es obligatorio'),
    }),
});
//# sourceMappingURL=auth.validators.js.map