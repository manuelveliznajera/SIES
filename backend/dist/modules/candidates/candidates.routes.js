"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.candidatesRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
// TODO: Implementar en Fase 3
exports.candidatesRouter = (0, express_1.Router)();
exports.candidatesRouter.use(authenticate_1.authenticate);
exports.candidatesRouter.get('/health', (_req, res) => {
    res.json({ success: true, module: 'candidates', status: 'stub - pendiente de implementación' });
});
//# sourceMappingURL=candidates.routes.js.map