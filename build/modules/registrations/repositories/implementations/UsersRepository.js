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
exports.UsersRepository = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = require("bcryptjs");
const prisma_1 = require("../../../../prisma");
const GenerateRefreshToken_1 = require("../../provider/GenerateRefreshToken");
const GenerateTokenProvider_1 = require("../../provider/GenerateTokenProvider");
const userUtils_1 = require("../../../../utils/userUtils");
class UsersRepository {
    constructor() {
        this.users = [];
    }
    filterUsers(listUserFormatted) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filteredUsers = yield (0, userUtils_1.filterPrismaUser)(listUserFormatted);
                return {
                    isValid: true,
                    statusCode: 202,
                    successMessage: 'Filter users.',
                    usersList: filteredUsers
                };
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                    return { isValid: false, errorMessage: error, statusCode: 403 };
                }
                else {
                    return { isValid: false, errorMessage: String(error), statusCode: 403 };
                }
            }
        });
    }
    createUsers(usersData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const passwordHash = yield (0, bcryptjs_1.hash)(usersData.password, Number(process.env.PASSWORD_HASH));
                const createUsers = yield (0, userUtils_1.createPrismaUser)(usersData, passwordHash);
                return {
                    isValid: true,
                    statusCode: 202,
                    users: {
                        id: createUsers.id,
                        name: createUsers.name,
                        email: createUsers.email,
                        username: createUsers.username
                    },
                    successMessage: 'Admnistrador criado com sucesso.'
                };
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientValidationError) {
                    const argumentPosition = error.message.search('Argument');
                    const mongoDBError = error.message.slice(argumentPosition);
                    return { isValid: false, errorMessage: mongoDBError, statusCode: 403 };
                }
                else {
                    return { isValid: false, errorMessage: String(error), statusCode: 403 };
                }
            }
        });
    }
    authenticateUsers({ username, password }) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                //Buscando o users
                const usersFound = yield prisma_1.prisma.users.findFirst({
                    where: {
                        username: username
                    }
                });
                //Checando se o username está correto
                if (!usersFound) {
                    return {
                        isValid: false,
                        statusCode: 403,
                        errorMessage: "Usuário ou senha incorretos."
                    };
                }
                //Checando se o password está correto
                const passwordMatch = yield (0, bcryptjs_1.compare)(password, usersFound.password);
                if (!passwordMatch) {
                    return {
                        isValid: false,
                        statusCode: 403,
                        errorMessage: "Usuário ou senha incorretos."
                    };
                }
                // Gerando o Token
                const generateTokenProvider = new GenerateTokenProvider_1.GenerateTokenProvider();
                const token = yield generateTokenProvider.execute(usersFound.id);
                //Gerando refresh token
                const generateRefreshToken = new GenerateRefreshToken_1.GenerateRefreshToken();
                const newRefreshToken = yield generateRefreshToken.execute(usersFound.id);
                return {
                    isValid: true,
                    token: token,
                    refreshToken: newRefreshToken.id,
                    users: usersFound,
                    statusCode: 202
                };
            }
            catch (error) {
                // if (error instanceof Prisma.PrismaClientValidationError) {
                //     const argumentPosition = error.message.search('Argument')
                //     const mongoDBError = error.message.slice(argumentPosition)
                //     return { isValid: false, errorMessage: mongoDBError, statusCode: 403 }
                // } else {
                return { isValid: false, errorMessage: String(error), statusCode: 403 };
                // }
            }
        });
    }
    testeUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            yield prisma_1.prisma.userInvestment.create({
                data: {
                    user: {
                        connect: {
                            id: 'sdfasdpfokasdpfokaf'
                        }
                    },
                    investment: {
                        connect: {
                            id: 'asdfpoaksdpofkasdofk'
                        }
                    }
                }
            });
            return;
        });
    }
}
exports.UsersRepository = UsersRepository;
