"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.refreshToken = refreshToken;
exports.logout = logout;
exports.me = me;
const auth_service_1 = require("./auth.service");
const auth_validators_1 = require("./auth.validators");
const env_1 = require("../../config/env");
const observability_1 = require("../../services/observability");
const isProduction = env_1.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
    httpOnly: true,
    // En desarrollo la app se prueba por HTTP desde localhost o una IP LAN.
    // Forzar cookies Secure en ese contexto hace que navegadores móviles las rechacen.
    secure: isProduction && env_1.env.COOKIE_SECURE,
    sameSite: isProduction ? env_1.env.COOKIE_SAME_SITE : 'lax',
    path: '/',
};
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 minutos
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 días
/**
 * POST /api/v1/auth/login
 * Autentica usuario y establece cookies httpOnly.
 */
async function login(req, res, next) {
    try {
        const { identifier, password } = auth_validators_1.loginSchema.shape.body.parse(req.body);
        const result = await auth_service_1.authService.login(identifier, password);
        if (!result.success || !result.accessToken || !result.refreshToken || !result.user) {
            await (0, observability_1.writeAuditEvent)(req, {
                userId: null,
                action: 'auth.login.failed',
                entityType: 'auth_session',
                changes: { identifier, resultCode: result.code ?? 'AUTH_FAILED' },
            });
            res.status(401).json({
                success: false,
                message: result.message ?? 'Error de autenticación.',
                code: result.code ?? 'AUTH_FAILED',
            });
            return;
        }
        // Almacenar tokens en httpOnly cookies (nunca en el body por seguridad XSS)
        res.cookie('access_token', result.accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: ACCESS_COOKIE_MAX_AGE,
        });
        res.cookie('refresh_token', result.refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: REFRESH_COOKIE_MAX_AGE,
            path: '/api/v1/auth/refresh', // Solo enviado a este endpoint
        });
        await (0, observability_1.writeAuditEvent)(req, {
            userId: result.user.id,
            action: 'auth.login.succeeded',
            entityType: 'auth_session',
            changes: { username: result.user.username, roles: result.user.roles },
        });
        res.status(200).json({
            success: true,
            user: result.user,
        });
    }
    catch (err) {
        next(err);
    }
}
/**
 * POST /api/v1/auth/refresh
 * Renueva el access token usando el refresh token de la cookie.
 */
async function refreshToken(req, res, next) {
    try {
        // Preferir cookie sobre body (más seguro)
        const token = req.cookies?.refresh_token ??
            auth_validators_1.refreshSchema.shape.body.safeParse(req.body).data?.refreshToken;
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Se requiere refresh token.',
                code: 'REFRESH_TOKEN_MISSING',
            });
            return;
        }
        const result = await auth_service_1.authService.refreshAccessToken(token);
        if (!result.success || !result.accessToken || !result.refreshToken) {
            // Limpiar cookies inválidas
            res.clearCookie('access_token', COOKIE_OPTIONS);
            res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, path: '/api/v1/auth/refresh' });
            res.status(401).json({
                success: false,
                message: result.message ?? 'Sesión inválida.',
                code: result.code ?? 'SESSION_INVALID',
            });
            return;
        }
        res.cookie('access_token', result.accessToken, {
            ...COOKIE_OPTIONS,
            maxAge: ACCESS_COOKIE_MAX_AGE,
        });
        res.cookie('refresh_token', result.refreshToken, {
            ...COOKIE_OPTIONS,
            maxAge: REFRESH_COOKIE_MAX_AGE,
            path: '/api/v1/auth/refresh',
        });
        res.status(200).json({
            success: true,
            user: result.user,
        });
    }
    catch (err) {
        next(err);
    }
}
/**
 * POST /api/v1/auth/logout
 * Revoca tokens y elimina cookies.
 */
async function logout(req, res, next) {
    try {
        if (req.user?.userId) {
            await auth_service_1.authService.logout(req.user.userId);
            await (0, observability_1.writeAuditEvent)(req, {
                action: 'auth.logout',
                entityType: 'auth_session',
                changes: { username: req.user.username },
            });
        }
        res.clearCookie('access_token', COOKIE_OPTIONS);
        res.clearCookie('refresh_token', { ...COOKIE_OPTIONS, path: '/api/v1/auth/refresh' });
        res.status(200).json({ success: true, message: 'Sesión cerrada correctamente.' });
    }
    catch (err) {
        next(err);
    }
}
/**
 * GET /api/v1/auth/me
 * Devuelve los datos del usuario autenticado actual.
 */
async function me(req, res) {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'No autenticado.' });
        return;
    }
    res.status(200).json({
        success: true,
        user: {
            id: req.user.userId,
            username: req.user.username,
            fullName: req.user.fullName ?? req.user.username,
            roles: req.user.roles,
            enumeratorId: req.user.enumeratorId ?? null,
        },
    });
}
//# sourceMappingURL=auth.controller.js.map