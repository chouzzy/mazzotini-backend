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
exports.FindUserByIDController = void 0;
const UsersRepository_1 = require("../../../repositories/implementations/UsersRepository");
const FindUserByIDUseCase_1 = require("./FindUserByIDUseCase");
const FindUserByIDCheck_1 = require("./FindUserByIDCheck");
const client_1 = require("@prisma/client");
class FindUserByIDController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                console.log('Token aceito!');
                yield (0, FindUserByIDCheck_1.checkQuery)(id);
                if (typeof (id) != 'string') {
                    throw Error("Formato do id inválido");
                }
                // Instanciando o useCase no repositório com as funções
                const usersRepository = new UsersRepository_1.UsersRepository();
                const findUserByIDUseCase = new FindUserByIDUseCase_1.FindUserByIDUseCase(usersRepository);
                const user = yield findUserByIDUseCase.execute(id);
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
                    return res.status(401).json({ error: { name: 'FindUserByIDController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.FindUserByIDController = FindUserByIDController;
