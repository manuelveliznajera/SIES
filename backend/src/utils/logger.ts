import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Formato de log legible en desarrollo.
 */
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? '\n  ' + JSON.stringify(meta, null, 2).replace(/\n/g, '\n  ')
      : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

/**
 * Formato JSON estructurado para producción.
 * Compatible con herramientas de observabilidad (Datadog, Grafana Loki, etc.).
 */
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    ...(env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 50 * 1024 * 1024, // 50 MB
            maxFiles: 10,
          }),
        ]
      : []),
  ],
});
