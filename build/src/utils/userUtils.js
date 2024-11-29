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
exports.filterResumedPrismaUser = exports.deleteAuth0User = exports.deletePrismaUser = exports.updatePrismaUser = exports.filterPrismaUser = exports.validatePageParams = exports.createPrismaUser = exports.getPrismaUsers = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_1 = require("../prisma");
function getPrismaUsersByID(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const searchedUser = yield prisma_1.prisma.users.findUnique({
                where: { id },
            });
            return searchedUser;
        }
        catch (error) {
            throw error;
        }
    });
}
function getPrismaUsers(usersData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const searchedUsers = yield prisma_1.prisma.users.findMany({
                where: {
                    OR: [
                        { username: usersData.username },
                    ],
                },
            });
            return searchedUsers;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.getPrismaUsers = getPrismaUsers;
function createPrismaUser(usersData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const existingUserByEmail = yield prisma_1.prisma.users.findUnique({ where: { email: usersData.email } });
            if (existingUserByEmail) {
                throw new Error('O Email já existe.');
            }
            const existingUserByCpf = yield prisma_1.prisma.users.findUnique({ where: { cpf: usersData.cpf } });
            if (existingUserByCpf) {
                throw new Error('O CPF já existe.');
            }
            const existingUserByUsername = yield prisma_1.prisma.users.findUnique({ where: { username: usersData.username } });
            if (existingUserByUsername) {
                throw new Error('O Username já existe.');
            }
            const { birth } = usersData;
            if (birth) {
                usersData.birth = new Date(birth);
            }
            const createUsers = yield prisma_1.prisma.users.create({
                data: usersData
            });
            return createUsers;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.createPrismaUser = createPrismaUser;
function validatePageParams(filterUserData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { page, pageRange } = filterUserData;
            const pageInt = Number(page) || 1;
            const pageRangeInt = Number(pageRange) || 10;
            if (!Number.isInteger(pageInt) || pageInt <= 0) {
                throw new Error('Invalid page number');
            }
            if (!Number.isInteger(pageRangeInt) || pageRangeInt <= 0) {
                throw new Error('Invalid page range');
            }
            return {
                page: pageInt,
                pageRange: pageRangeInt,
            };
        }
        catch (error) {
            throw error;
        }
    });
}
exports.validatePageParams = validatePageParams;
function filterPrismaUser(listUserFormatted) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id, name, email, cpf, username, page, pageRange } = listUserFormatted;
            const filteredUsers = yield prisma_1.prisma.users.findMany({
                where: {
                    AND: [
                        { id },
                        { name },
                        { email },
                        { cpf },
                        { username }
                    ]
                },
                skip: (page - 1) * pageRange,
                take: pageRange,
            });
            return filteredUsers;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.filterPrismaUser = filterPrismaUser;
function filterResumedPrismaUser(listUserFormatted) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { id, name, email, role, page, pageRange } = listUserFormatted;
            // Fix this for me, select is not working:
            const filteredUsers = yield prisma_1.prisma.users.findMany({
                where: {
                    AND: [
                        { id },
                        { name },
                        { email },
                        { role }
                    ]
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    investorProfileName: true
                },
                skip: (page - 1) * pageRange,
                take: pageRange,
            });
            return filteredUsers;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.filterResumedPrismaUser = filterResumedPrismaUser;
function updatePrismaUser(usersData, id) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const user = yield getPrismaUsersByID(id);
            if (!user) {
                throw Error("Usuário não encontrado.");
            }
            const updatedUser = yield prisma_1.prisma.users.update({
                where: { id },
                data: {
                    name: (_a = usersData.name) !== null && _a !== void 0 ? _a : user.name,
                    email: (_b = usersData.email) !== null && _b !== void 0 ? _b : user.email,
                    phoneNumber: (_c = usersData.phoneNumber) !== null && _c !== void 0 ? _c : user.phoneNumber,
                    gender: (_d = usersData.gender) !== null && _d !== void 0 ? _d : user.gender,
                    profession: (_e = usersData.profession) !== null && _e !== void 0 ? _e : user.profession,
                    birth: (_f = usersData.birth) !== null && _f !== void 0 ? _f : user.birth,
                    username: (_g = usersData.username) !== null && _g !== void 0 ? _g : user.username,
                    address: (_h = usersData.address) !== null && _h !== void 0 ? _h : user.address,
                    investorProfileName: (_j = usersData.investorProfileName) !== null && _j !== void 0 ? _j : user.investorProfileName,
                    investorProfileDescription: (_k = usersData.investorProfileDescription) !== null && _k !== void 0 ? _k : user.investorProfileDescription
                },
            });
            return updatedUser;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.updatePrismaUser = updatePrismaUser;
function deletePrismaUser(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const deletedUser = yield prisma_1.prisma.users.delete({
                where: { id }
            });
            return deletedUser;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.deletePrismaUser = deletePrismaUser;
function deleteAuth0User(auth0UserID, accessToken) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('vamos deletar auth0');
            const options = {
                method: 'delete',
                maxBodyLength: Infinity,
                url: `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${auth0UserID}`,
                headers: { Authorization: `Bearer ${process.env.AUTH0_MANAGEMENTAPI_TOKEN}`, }
            };
            const response = yield axios_1.default.request(options);
            console.log('vamos deletar auth0');
            console.log(response);
            // if (response.status === 204) {
            // }
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    });
}
exports.deleteAuth0User = deleteAuth0User;
