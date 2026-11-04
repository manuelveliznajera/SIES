"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const authenticate_1 = require("../../middleware/authenticate");
exports.authRouter = (0, express_1.Router)();
/**
 * POST /api/v1/auth/login
 * Body: { identifier: string, password: string }
 */
exports.authRouter.post('/login', auth_controller_1.login);
/**
 * POST /api/v1/auth/refresh
 * Cookie: refresh_token (httpOnly) o Body: { refreshToken: string }
 */
exports.authRouter.post('/refresh', auth_controller_1.refreshToken);
/**
 * POST /api/v1/auth/logout
 * Requiere autenticación. Revoca sesión y elimina cookies.
 */
exports.authRouter.post('/logout', authenticate_1.authenticate, auth_controller_1.logout);
/**
 * GET /api/v1/auth/me
 * Devuelve el usuario autenticado actual.
 */
exports.authRouter.get('/me', authenticate_1.authenticate, auth_controller_1.me);
//# sourceMappingURL=auth.routes.js.map