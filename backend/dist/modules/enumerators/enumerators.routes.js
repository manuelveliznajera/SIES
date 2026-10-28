"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enumeratorsRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
// TODO: Implementar en Fase 3
exports.enumeratorsRouter = (0, express_1.Router)();
exports.enumeratorsRouter.use(authenticate_1.authenticate);
exports.enumeratorsRouter.get('/health', (_req, res) => {
    res.json({ success: true, module: 'enumerators', status: 'stub - pendiente de implementación' });
});
//# sourceMappingURL=enumerators.routes.js.map