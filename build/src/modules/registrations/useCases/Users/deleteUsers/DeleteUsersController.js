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
exports.DeleteUsersController = void 0;
const DeleteUsersUseCase_1 = require("./DeleteUsersUseCase");
const UsersRepository_1 = require("../../../repositories/implementations/UsersRepository");
const DeleteUsersCheck_1 = require("./DeleteUsersCheck");
const axios_1 = require("axios");
const client_1 = require("@prisma/client");
class DeleteUsersController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, auth0UserID } = req.body;
                if (typeof (id) != 'string') {
                    return res.status(401).json({ Error: "ID inválido" });
                }
                if (typeof (auth0UserID) != 'string') {
                    return res.status(401).json({ Error: "auth0UserID inválido" });
                }
                if (!auth0UserID) {
                    throw Error("auth0UserID ausente.");
                }
                yield (0, DeleteUsersCheck_1.checkBody)(id);
                const userRepository = new UsersRepository_1.UsersRepository();
                const deleteUsersUseCase = new DeleteUsersUseCase_1.DeleteUsersUseCase(userRepository);
                const deletedMessage = yield deleteUsersUseCase.execute(id, auth0UserID);
                return res.status(200).json({
                    successMessage: deletedMessage
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
                    return res.status(401).json({ error: { name: 'DeleteUsersController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.DeleteUsersController = DeleteUsersController;
