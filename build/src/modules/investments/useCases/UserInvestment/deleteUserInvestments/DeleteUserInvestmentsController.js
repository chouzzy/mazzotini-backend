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
exports.DeleteUserInvestmentsController = void 0;
const DeleteUserInvestmentsUseCase_1 = require("./DeleteUserInvestmentsUseCase");
const DeleteUserInvestmentsCheck_1 = require("./DeleteUserInvestmentsCheck");
const axios_1 = require("axios");
const client_1 = require("@prisma/client");
const UserInvestmentRepository_1 = require("../../../repositories/implementations/UserInvestmentRepository");
class DeleteUserInvestmentsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (typeof (id) != 'string') {
                    return res.status(401).json({ Error: "ID inválido" });
                }
                yield (0, DeleteUserInvestmentsCheck_1.checkBody)(id);
                const userRepository = new UserInvestmentRepository_1.UserInvestmentRepository();
                const deleteUsersUseCase = new DeleteUserInvestmentsUseCase_1.DeleteUsersUseCase(userRepository);
                const userInvestmentDeleted = yield deleteUsersUseCase.execute(id);
                return res.status(200).json({
                    userInvestmentDeleted: userInvestmentDeleted
                });
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                    return res.status(401).json({
                        error: {
                            name: error.name,
                            message: error.message
                        }
                    });
                }
                else if (error instanceof axios_1.AxiosError) {
                    return res.status(401).json({ error });
                }
                else {
                    return res.status(401).json({ error: { name: 'DeleteUserInvestmentsController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.DeleteUserInvestmentsController = DeleteUserInvestmentsController;
