"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncRateLimiter = exports.generalRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../config/env");
/**
 * Rate limiter general para toda la API.
 * Límite: 100 peticiones por ventana de 15 minutos (configurable por env).
 */
exports.generalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: env_1.env.RATE_LIMIT_WINDOW_MS,
    max: env_1.env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Demasiadas solicitudes. Por favor intenta nuevamente en unos minutos.',
        code: 'RATE_LIMIT_EXCEEDED',
    },
    skip: () => env_1.env.NODE_ENV === 'test',
});
/**
 * Rate limiter para sincronización (más permisivo).
 * Los encuestadores pueden sincronizar varias veces en poco tiempo.
 */
exports.syncRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minuto
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Demasiadas solicitudes de sincronización. Por favor espera un momento.',
        code: 'SYNC_RATE_LIMIT_EXCEEDED',
    },
    skip: () => env_1.env.NODE_ENV === 'test',
});
//# sourceMappingURL=rateLimiter.js.map