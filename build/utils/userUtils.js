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
exports.filterPrismaUser = exports.validatePageParams = exports.createPrismaUser = exports.getPrismaUsers = void 0;
const prisma_1 = require("../prisma");
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
function createPrismaUser(usersData, passwordHash) {
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
            const createUsers = yield prisma_1.prisma.users.create({
                data: {
                    name: usersData.name,
                    email: usersData.email,
                    cpf: usersData.cpf,
                    username: usersData.username,
                    password: passwordHash,
                }
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
            const filteredInvestment = yield prisma_1.prisma.users.findMany({
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
            return filteredInvestment;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.filterPrismaUser = filterPrismaUser;
