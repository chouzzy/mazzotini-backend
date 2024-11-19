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
exports.ResetPasswordUsersController = void 0;
const UsersRepository_1 = require("../../../repositories/implementations/UsersRepository");
const ResetPasswordUsersUseCase_1 = require("./ResetPasswordUsersUseCase");
const client_1 = require("@prisma/client");
const ResetPasswordUsersCheck_1 = require("./ResetPasswordUsersCheck");
class ResetPasswordUsersController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const body = req.body;
                const { email } = req.body;
                if (!email) {
                    throw Error("E-mail ausente na requisição");
                }
                yield (0, ResetPasswordUsersCheck_1.checkBody)(body);
                // Instanciando o useCase no repositório com as funções
                const usersRepository = new UsersRepository_1.UsersRepository();
                const resetPasswordUsersUseCaseUseCase = new ResetPasswordUsersUseCase_1.ResetPasswordUsersUseCase(usersRepository);
                yield resetPasswordUsersUseCaseUseCase.execute(email);
                return res.status(200).json({
                    successMessage: "Enviamos um email para redefinir sua senha. Verifique sua caixa de entrada!",
                });
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientValidationError) {
                    return res.status(401).json({
                        error: {
                            name: error.name,
                            message: error.message,
                        }
                    });
                }
                else {
                    return res.status(401).json({ error: { name: 'ResetPasswordUsersController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.ResetPasswordUsersController = ResetPasswordUsersController;
