"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.surveysRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
const surveys_controller_1 = require("./surveys.controller");
exports.surveysRouter = (0, express_1.Router)();
exports.surveysRouter.use(authenticate_1.authenticate);
exports.surveysRouter.get('/', surveys_controller_1.listSurveys);
exports.surveysRouter.post('/', (0, authenticate_1.authorize)(['ADMIN']), surveys_controller_1.createSurvey);
exports.surveysRouter.patch('/:id', (0, authenticate_1.authorize)(['ADMIN']), surveys_controller_1.updateSurvey);
exports.surveysRouter.delete('/:id', (0, authenticate_1.authorize)(['ADMIN']), surveys_controller_1.archiveSurvey);
//# sourceMappingURL=surveys.routes.js.map