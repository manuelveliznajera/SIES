"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentsRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
// TODO: Implementar en Fase 3
exports.assignmentsRouter = (0, express_1.Router)();
exports.assignmentsRouter.use(authenticate_1.authenticate);
exports.assignmentsRouter.get('/health', (_req, res) => {
    res.json({ success: true, module: 'assignments', status: 'stub - pendiente de implementación' });
});
//# sourceMappingURL=assignments.routes.js.map