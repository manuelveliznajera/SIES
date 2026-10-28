"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const env_1 = require("../config/env");
const { combine, timestamp, printf, colorize, errors } = winston_1.default.format;
/**
 * Formato de log legible en desarrollo.
 */
const devFormat = combine(colorize({ all: true }), timestamp({ format: 'HH:mm:ss' }), errors({ stack: true }), printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length
        ? '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')
        : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
}));
/**
 * Formato JSON estructurado para producción.
 * Compatible con herramientas de observabilidad (Datadog, Grafana Loki, etc.).
 */
const prodFormat = combine(timestamp(), errors({ stack: true }), winston_1.default.format.json());
exports.logger = winston_1.default.createLogger({
    level: env_1.env.LOG_LEVEL,
    format: env_1.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    transports: [
        new winston_1.default.transports.Console(),
        ...(env_1.env.NODE_ENV === 'production'
            ? [
                new winston_1.default.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    maxsize: 10 * 1024 * 1024, // 10 MB
                    maxFiles: 5,
                }),
                new winston_1.default.transports.File({
                    filename: 'logs/combined.log',
                    maxsize: 50 * 1024 * 1024, // 50 MB
                    maxFiles: 10,
                }),
            ]
            : []),
    ],
});
//# sourceMappingURL=logger.js.map