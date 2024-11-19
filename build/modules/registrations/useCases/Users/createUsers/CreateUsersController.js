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
exports.CreateUsersController = void 0;
const CreateUsersUseCase_1 = require("./CreateUsersUseCase");
const UsersRepository_1 = require("../../../repositories/implementations/UsersRepository");
const CreateUsersCheck_1 = require("./CreateUsersCheck");
class CreateUsersController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const usersData = req.body;
            const bodyValidation = yield (0, CreateUsersCheck_1.checkBody)(usersData);
            if (bodyValidation.isValid === false) {
                return res.status(401).json({ Error: bodyValidation.errorMessage });
            }
            /// instanciação da classe do caso de uso
            const userRepository = new UsersRepository_1.UsersRepository();
            const createUsersUseCase = new CreateUsersUseCase_1.CreateUsersUseCase(userRepository);
            const response = yield createUsersUseCase.execute(usersData);
            return res.status(response.statusCode).json(response);
        });
    }
}
exports.CreateUsersController = CreateUsersController;
