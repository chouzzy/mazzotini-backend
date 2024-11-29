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
exports.FindUserByEmailController = void 0;
const UsersRepository_1 = require("../../../repositories/implementations/UsersRepository");
const FindUserByEmailUseCase_1 = require("./FindUserByEmailUseCase");
const FindUserByEmailCheck_1 = require("./FindUserByEmailCheck");
const client_1 = require("@prisma/client");
class FindUserByEmailController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = req.query;
                console.log('Token aceito!');
                const { email } = query;
                yield (0, FindUserByEmailCheck_1.checkQuery)(query);
                if (typeof (email) != 'string') {
                    throw Error("Formato do e-mail inválido");
                }
                // Instanciando o useCase no repositório com as funções
                const usersRepository = new UsersRepository_1.UsersRepository();
                const findUserByEmailUseCase = new FindUserByEmailUseCase_1.FindUserByEmailUseCase(usersRepository);
                const user = yield findUserByEmailUseCase.execute(email);
                return res.status(200).json({
                    successMessage: "Usuário encontrado com sucesso!",
                    user: user
                });
            }
            catch (error) {
                console.log(error);
                if (error instanceof Error) {
                    if (error.message == "Usuário não encontrado.") {
                        return res.status(404).json({
                            error: {
                                name: error.name,
                                message: error.message,
                            }
                        });
                    }
                }
                if (error instanceof client_1.Prisma.PrismaClientValidationError) {
                    return res.status(401).json({
                        error: {
                            name: error.name,
                            message: error.message,
                        }
                    });
                }
                else {
                    return res.status(401).json({ error: { name: 'FindUserByEmailController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.FindUserByEmailController = FindUserByEmailController;
