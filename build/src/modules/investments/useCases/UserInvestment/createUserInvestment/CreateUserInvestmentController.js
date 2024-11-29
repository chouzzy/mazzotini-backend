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
exports.CreateUserInvestmentController = void 0;
const UserInvestmentRepository_1 = require("../../../repositories/implementations/UserInvestmentRepository");
const CreateUserInvestmentCheck_1 = require("./CreateUserInvestmentCheck");
const CreateUserInvestmentUseCase_1 = require("./CreateUserInvestmentUseCase");
const uuid_1 = require("uuid");
class CreateUserInvestmentController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const userInvestmentData = req.body;
            const { documents } = userInvestmentData;
            if (documents) {
                documents.map((doc) => {
                    doc.id = (0, uuid_1.v4)();
                });
            }
            const bodyValidation = yield (0, CreateUserInvestmentCheck_1.checkBody)(userInvestmentData);
            if (bodyValidation.isValid === false) {
                return res.status(401).json({ errorMessage: bodyValidation.errorMessage });
            }
            /// instanciação da classe do caso de uso
            const userRepository = new UserInvestmentRepository_1.UserInvestmentRepository();
            const createUsersUseCase = new CreateUserInvestmentUseCase_1.CreateUserInvestmentUseCase(userRepository);
            const response = yield createUsersUseCase.execute(userInvestmentData);
            return res.status(response.statusCode).json(response);
        });
    }
}
exports.CreateUserInvestmentController = CreateUserInvestmentController;
