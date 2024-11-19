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
const client_1 = require("@prisma/client");
class ListUsersController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = req.query;
                const accessToken = req.cookies;
                console.log('Token aceito!');
                console.log(accessToken);
                yield (0, ListUsersCheck_1.checkQuery)(query);
                // Instanciando o useCase no repositório com as funções
                const usersRepository = new UsersRepository_1.UsersRepository();
                const listUsersUseCase = new ListUsersUseCase_1.ListUsersUseCase(usersRepository);
                const users = yield listUsersUseCase.execute(query);
                return res.status(200).json({
                    successMessage: "Usuários listados com sucesso!",
                    users: users
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
                    return res.status(401).json({ error: { name: 'ListUsersController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.ListUsersController = ListUsersController;
