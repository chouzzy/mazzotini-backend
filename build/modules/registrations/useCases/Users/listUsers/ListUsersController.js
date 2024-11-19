"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListUsersController = void 0;
const UsersRepository_1 = require("../../../repositories/implementations/UsersRepository");
const ListUsersUseCase_1 = require("./ListUsersUseCase");
const ListUsersCheck_1 = require("./ListUsersCheck");
class ListUsersController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = req.query;
            const queryValidation = yield (0, ListUsersCheck_1.checkQuery)(query);
            if (queryValidation.isValid === false) {
                return res.status(401).json({ Error: queryValidation.errorMessage });
            }
            // Instanciando o useCase no repositório com as funções
            const usersRepository = new UsersRepository_1.UsersRepository();
            const listUsersUseCase = new ListUsersUseCase_1.ListUsersUseCase(usersRepository);
            const response = yield listUsersUseCase.execute(query);
            return res.status(response.statusCode).json(response);
        });
    }
}
exports.ListUsersController = ListUsersController;
