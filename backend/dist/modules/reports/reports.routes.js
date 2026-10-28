"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
// TODO: Implementar en Fase 3
exports.reportsRouter = (0, express_1.Router)();
exports.reportsRouter.use(authenticate_1.authenticate);
exports.reportsRouter.get('/health', (_req, res) => {
    res.json({ success: true, module: 'reports', status: 'stub - pendiente de implementación' });
});
//# sourceMappingURL=reports.routes.js.map