"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLogsRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
const adminLogs_controller_1 = require("./adminLogs.controller");
exports.adminLogsRouter = (0, express_1.Router)();
exports.adminLogsRouter.use(authenticate_1.authenticate);
exports.adminLogsRouter.post('/frontend-errors', adminLogs_controller_1.reportFrontendError);
exports.adminLogsRouter.get('/audit', (0, authenticate_1.authorize)(['ADMIN']), adminLogs_controller_1.listAuditEvents);
exports.adminLogsRouter.get('/errors', (0, authenticate_1.authorize)(['ADMIN']), adminLogs_controller_1.listApplicationErrors);
//# sourceMappingURL=adminLogs.routes.js.map