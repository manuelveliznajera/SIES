"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
// TODO: Implementar en Fase 3
exports.syncRouter = (0, express_1.Router)();
exports.syncRouter.use(authenticate_1.authenticate);
exports.syncRouter.get('/health', (_req, res) => {
    res.json({ success: true, module: 'synchronization', status: 'stub - pendiente de implementación' });
});
//# sourceMappingURL=sync.routes.js.map