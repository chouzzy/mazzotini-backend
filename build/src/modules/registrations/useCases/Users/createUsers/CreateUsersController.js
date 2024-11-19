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
const client_1 = require("@prisma/client");
class CreateUsersController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const usersData = req.body;
                yield (0, CreateUsersCheck_1.checkBody)(usersData);
                /// instanciação da classe do caso de uso
                const userRepository = new UsersRepository_1.UsersRepository();
                const createUsersUseCase = new CreateUsersUseCase_1.CreateUsersUseCase(userRepository);
                const user = yield createUsersUseCase.execute(usersData);
                return res.status(200).json({
                    successMessage: "Usuário criado com sucesso!",
                    user: user
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
                    return res.status(401).json({ error: { name: 'CreateUsersController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.CreateUsersController = CreateUsersController;
