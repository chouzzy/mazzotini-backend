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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersRepository = void 0;
const axios_1 = __importDefault(require("axios"));
const userUtils_1 = require("../../../../utils/userUtils");
const prisma_1 = require("../../../../prisma");
class UsersRepository {
    constructor() {
        this.users = [];
    }
    findUserByID(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const uniqueUser = yield prisma_1.prisma.users.findUnique({
                    where: { id: id }
                });
                if (!uniqueUser) {
                    throw Error("Usuário não encontrado.");
                }
                return uniqueUser;
            }
            catch (error) {
                throw error;
            }
        });
    }
    findUserByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const uniqueUser = yield prisma_1.prisma.users.findUnique({
                    where: { email: email }
                });
                if (!uniqueUser) {
                    throw Error("Usuário não encontrado.");
                }
                return uniqueUser;
            }
            catch (error) {
                throw error;
            }
        });
    }
    filterUsers(listUserFormatted) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filteredUsers = yield (0, userUtils_1.filterPrismaUser)(listUserFormatted);
                return filteredUsers;
            }
            catch (error) {
                console.log('error');
                console.log(error);
                throw error;
            }
        });
    }
    listResumedUsers(listUserFormatted) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filteredResumedUsers = yield (0, userUtils_1.filterResumedPrismaUser)(listUserFormatted);
                return filteredResumedUsers;
            }
            catch (error) {
                throw error;
            }
        });
    }
    createUsers(usersData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const createUsers = yield (0, userUtils_1.createPrismaUser)(usersData);
                return {
                    id: createUsers.id,
                    name: createUsers.name,
                    email: createUsers.email,
                    username: createUsers.username
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
    updateUsers(usersData, id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedUser = yield (0, userUtils_1.updatePrismaUser)(usersData, id);
                return updatedUser;
            }
            catch (error) {
                throw error;
            }
        });
    }
    resetPassword(email) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const clientID = process.env.AUTH0_CLIENT_ID;
                if (!clientID) {
                    throw Error('ClientID não definido');
                }
                const options = {
                    method: 'POST',
                    url: `${process.env.AUTH0_ISSUER_BASE_URL}/dbconnections/change_password`,
                    headers: { 'content-type': 'application/json' },
                    data: {
                        client_id: clientID,
                        email: email,
                        connection: 'Username-Password-Authentication'
                    }
                };
                yield axios_1.default.request(options);
            }
            catch (error) {
                throw error;
            }
        });
    }
    deleteUsers(id, auth0UserID) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // await deleteAuth0User(auth0UserID, accessToken)
                const deletedUser = yield (0, userUtils_1.deletePrismaUser)(id);
                return "Usuário deletado com sucesso.";
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.UsersRepository = UsersRepository;
// Autenticação é feita pelo auth0
// async authenticateUsers({ username, password }: AuthenticateUsersRequestProps): Promise<validationResponse> {
//     try {
//         //Buscando o users
//         const usersFound = await prisma.users.findFirst({
//             where: {
//                 username: username
//             }
//         })
//         //Checando se o username está correto
//         if (!usersFound) {
//             return {
//                 isValid: false,
//                 statusCode: 403,
//                 errorMessage: "Usuário ou senha incorretos."
//             }
//         }
//         //Checando se o password está correto
//         const passwordMatch = await compare(password, usersFound.password)
//         if (!passwordMatch) {
//             return {
//                 isValid: false,
//                 statusCode: 403,
//                 errorMessage: "Usuário ou senha incorretos."
//             }
//         }
//         // Gerando o Token
//         const generateTokenProvider = new GenerateTokenProvider()
//         const token = await generateTokenProvider.execute(usersFound.id)
//         //Gerando refresh token
//         const generateRefreshToken = new GenerateRefreshToken()
//         const newRefreshToken = await generateRefreshToken.execute(usersFound.id)
//         return {
//             isValid: true,
//             token: token,
//             refreshToken: newRefreshToken.id,
//             users: usersFound,
//             statusCode: 202
//         }
//     } catch (error) {
//         // if (error instanceof Prisma.PrismaClientValidationError) {
//         //     const argumentPosition = error.message.search('Argument')
//         //     const mongoDBError = error.message.slice(argumentPosition)
//         //     return { isValid: false, errorMessage: mongoDBError, statusCode: 403 }
//         // } else {
//         return { isValid: false, errorMessage: String(error), statusCode: 403 }
//         // }
//     }
// }
