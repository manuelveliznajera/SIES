"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewsRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
const interviews_controller_1 = require("./interviews.controller");
exports.interviewsRouter = (0, express_1.Router)();
exports.interviewsRouter.use(authenticate_1.authenticate);
exports.interviewsRouter.get('/', (0, authenticate_1.authorize)(['ADMIN', 'SUPERVISOR', 'ENUMERATOR']), interviews_controller_1.listInterviews);
exports.interviewsRouter.post('/', (0, authenticate_1.authorize)(['ADMIN', 'ENUMERATOR']), interviews_controller_1.createInterview);
//# sourceMappingURL=interviews.routes.js.map