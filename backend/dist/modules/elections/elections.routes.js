"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electionsRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
// TODO: Implementar en Fase 3
exports.electionsRouter = (0, express_1.Router)();
exports.electionsRouter.use(authenticate_1.authenticate);
exports.electionsRouter.get('/health', (_req, res) => {
    res.json({ success: true, module: 'elections', status: 'stub - pendiente de implementación' });
});
//# sourceMappingURL=elections.routes.js.map