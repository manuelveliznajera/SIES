"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
/**
 * Middleware de autenticación.
 * Verifica el token JWT almacenado en httpOnly cookie o en el header Authorization.
 * Si el token es inválido o falta, responde con 401.
 */
function authenticate(req, res, next) {
    // Primero intentar desde cookie (más seguro)
    let token = req.cookies?.access_token;
    // Fallback: header Authorization (para clientes que no soporten cookies)
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    if (!token) {
        res.status(401).json({
            success: false,
            message: 'Autenticación requerida. Por favor inicia sesión.',
            code: 'AUTH_REQUIRED',
        });
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        req.user = payload;
        next();
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                success: false,
                message: 'La sesión ha expirado. Por favor inicia sesión nuevamente.',
                code: 'TOKEN_EXPIRED',
            });
            return;
        }
        logger_1.logger.warn('Token JWT inválido', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            error: err instanceof Error ? err.message : 'Unknown',
        });
        res.status(401).json({
            success: false,
            message: 'Token de autenticación inválido.',
            code: 'TOKEN_INVALID',
        });
    }
}
/**
 * Middleware de autorización por roles.
 * Debe usarse DESPUÉS de authenticate.
 *
 * @example
 * router.get('/admin', authenticate, authorize(['ADMIN']), handler)
 * router.post('/interviews', authenticate, authorize(['ADMIN', 'ENUMERATOR']), handler)
 */
function authorize(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Autenticación requerida.',
                code: 'AUTH_REQUIRED',
            });
            return;
        }
        const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
        if (!hasRole) {
            logger_1.logger.warn('Acceso denegado por roles insuficientes', {
                userId: req.user.userId,
                userRoles: req.user.roles,
                requiredRoles: allowedRoles,
                path: req.path,
            });
            res.status(403).json({
                success: false,
                message: 'No tienes permisos para realizar esta acción.',
                code: 'FORBIDDEN',
            });
            return;
        }
        next();
    };
}
//# sourceMappingURL=authenticate.js.map