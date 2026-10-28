"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geographyRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
// TODO: Implementar en Fase 3
exports.geographyRouter = (0, express_1.Router)();
exports.geographyRouter.use(authenticate_1.authenticate);
exports.geographyRouter.get('/health', (_req, res) => {
    res.json({ success: true, module: 'geography', status: 'stub - pendiente de implementación' });
});
//# sourceMappingURL=geography.routes.js.map