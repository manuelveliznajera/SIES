"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
// Rutas
const auth_routes_1 = require("./modules/auth/auth.routes");
const geography_routes_1 = require("./modules/geography/geography.routes");
const enumerators_routes_1 = require("./modules/enumerators/enumerators.routes");
const surveys_routes_1 = require("./modules/surveys/surveys.routes");
const elections_routes_1 = require("./modules/elections/elections.routes");
const candidates_routes_1 = require("./modules/candidates/candidates.routes");
const assignments_routes_1 = require("./modules/assignments/assignments.routes");
const interviews_routes_1 = require("./modules/interviews/interviews.routes");
const sync_routes_1 = require("./modules/synchronization/sync.routes");
const reports_routes_1 = require("./modules/reports/reports.routes");
const users_routes_1 = require("./modules/users/users.routes");
function createApp() {
    const app = (0, express_1.default)();
    // ── Seguridad HTTP ──────────────────────────────────
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));
    // ── CORS ────────────────────────────────────────────
    app.use((0, cors_1.default)({
        origin: env_1.env.CORS_ORIGIN.split(',').map((o) => o.trim()),
        credentials: true, // Necesario para cookies httpOnly
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    // ── Parsers ─────────────────────────────────────────
    app.use(express_1.default.json({ limit: '5mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '5mb' }));
    app.use((0, cookie_parser_1.default)(env_1.env.COOKIE_SECRET));
    // ── Logging HTTP ────────────────────────────────────
    app.use((0, morgan_1.default)('combined', {
        stream: { write: (msg) => logger_1.logger.http(msg.trim()) },
        skip: () => env_1.env.NODE_ENV === 'test',
    }));
    // ── Rate limiting general ───────────────────────────
    app.use(`/api/${env_1.env.API_VERSION}`, rateLimiter_1.generalRateLimiter);
    // ── Health check (no requiere autenticación) ────────
    app.get('/api/health', (_req, res) => {
        res.json({
            success: true,
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: env_1.env.API_VERSION,
            environment: env_1.env.NODE_ENV,
        });
    });
    // ── Rutas de la API ─────────────────────────────────
    const apiBase = `/api/${env_1.env.API_VERSION}`;
    app.use(`${apiBase}/auth`, auth_routes_1.authRouter);
    app.use(`${apiBase}/users`, users_routes_1.usersRouter);
    app.use(`${apiBase}/geography`, geography_routes_1.geographyRouter);
    app.use(`${apiBase}/enumerators`, enumerators_routes_1.enumeratorsRouter);
    app.use(`${apiBase}/surveys`, surveys_routes_1.surveysRouter);
    app.use(`${apiBase}/elections`, elections_routes_1.electionsRouter);
    app.use(`${apiBase}/candidates`, candidates_routes_1.candidatesRouter);
    app.use(`${apiBase}/assignments`, assignments_routes_1.assignmentsRouter);
    app.use(`${apiBase}/interviews`, interviews_routes_1.interviewsRouter);
    app.use(`${apiBase}/sync`, sync_routes_1.syncRouter);
    app.use(`${apiBase}/reports`, reports_routes_1.reportsRouter);
    // ── Manejadores de error ────────────────────────────
    app.use(errorHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map