"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewsRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
// TODO: Implementar en Fase 3
exports.interviewsRouter = (0, express_1.Router)();
exports.interviewsRouter.use(authenticate_1.authenticate);
exports.interviewsRouter.get('/health', (_req, res) => {
    res.json({ success: true, module: 'interviews', status: 'stub - pendiente de implementación' });
});
//# sourceMappingURL=interviews.routes.js.map