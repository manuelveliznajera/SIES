"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const authenticate_1 = require("../../middleware/authenticate");
const users_controller_1 = require("./users.controller");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.use(authenticate_1.authenticate);
exports.usersRouter.use((0, authenticate_1.authorize)(['ADMIN']));
exports.usersRouter.get('/', users_controller_1.listUsers);
exports.usersRouter.post('/', users_controller_1.createUser);
exports.usersRouter.patch('/:id', users_controller_1.updateUser);
exports.usersRouter.patch('/:id/activate', users_controller_1.activateUser);
exports.usersRouter.delete('/:id', users_controller_1.deactivateUser);
//# sourceMappingURL=users.routes.js.map