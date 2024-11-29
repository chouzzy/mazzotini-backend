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
exports.validatePageParams = exports.deletePrismaUserInvestments = exports.filterPrismaUserInvestmentsByInvestmentID = exports.filterPrismaInvestmentsByInvestmentID = exports.filterPrismaInvestmentsByUserID = exports.filterPrismaUserInvestment = exports.createPrismaUserInvestment = void 0;
const prisma_1 = require("../prisma");
function createPrismaUserInvestment(userInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { userID, investmentID, investedValue, valorCorrente, dataInvestimento, documents } = userInvestmentData;
            const userInvestment = yield prisma_1.prisma.userInvestment.create({
                data: {
                    user: {
                        connect: {
                            id: userID
                        }
                    },
                    investment: {
                        connect: {
                            id: investmentID
                        }
                    },
                    investedValue: investedValue,
                    valorCorrente: valorCorrente,
                    documents: documents,
                    dataInvestimento: dataInvestimento,
                }
            });
            return userInvestment;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.createPrismaUserInvestment = createPrismaUserInvestment;
function filterPrismaUserInvestment(listUserInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { userID, investmentID, page, pageRange } = listUserInvestmentData;
            if (!userID && !investmentID) {
                const userInvestment = yield prisma_1.prisma.userInvestment.findMany({
                    skip: (page - 1) * pageRange,
                    take: pageRange,
                });
                return userInvestment;
            }
            const userInvestment = yield prisma_1.prisma.userInvestment.findMany({
                where: {
                    AND: [
                        { userID },
                        { investmentID }
                    ]
                },
                skip: (page - 1) * pageRange,
                take: pageRange,
            });
            return userInvestment;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.filterPrismaUserInvestment = filterPrismaUserInvestment;
function filterPrismaInvestmentsByUserID(listUserInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { userID, page, pageRange } = listUserInvestmentData;
            // PEGA A LISTA DE INVESTIMENTOS DESSE USUARIO
            const userInvestmentList = yield prisma_1.prisma.userInvestment.findMany({
                where: { userID: userID },
                skip: (page - 1) * pageRange,
                take: pageRange,
            });
            // LISTA OS IDS DO INVESTIMENTO
            const investmentIDs = userInvestmentList.map((userInvestment) => { return userInvestment.investmentID; });
            // FILTRA TODOS OS INVESTIMENTOS QUE POSSUEM OS IDS ENCONTRADOS
            const investments = yield prisma_1.prisma.investment.findMany({
                where: {
                    id: {
                        in: investmentIDs, // Filtra os investimentos com base na lista de IDs
                    },
                },
            });
            return investments;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.filterPrismaInvestmentsByUserID = filterPrismaInvestmentsByUserID;
function filterPrismaInvestmentsByInvestmentID(listUserInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { investmentID, page, pageRange } = listUserInvestmentData;
            // PEGA A LISTA DE INVESTIMENTOS DESSE USUARIO
            const userInvestmentList = yield prisma_1.prisma.userInvestment.findMany({
                where: { investmentID: investmentID },
                skip: (page - 1) * pageRange,
                take: pageRange,
            });
            // LISTA OS IDS DO INVESTIMENTO
            const userIDs = userInvestmentList.map((userInvestment) => { return userInvestment.userID; });
            // FILTRA TODOS OS INVESTIMENTOS QUE POSSUEM OS IDS ENCONTRADOS
            const users = yield prisma_1.prisma.users.findMany({
                where: {
                    id: {
                        in: userIDs, // Filtra os investimentos com base na lista de IDs
                    },
                },
            });
            return users;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.filterPrismaInvestmentsByInvestmentID = filterPrismaInvestmentsByInvestmentID;
function filterPrismaUserInvestmentsByInvestmentID(listUserInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { investmentID, page, pageRange } = listUserInvestmentData;
            // PEGA A LISTA DE INVESTIMENTOS NESSE PROJETO
            const userInvestmentList = yield prisma_1.prisma.userInvestment.findMany({
                where: { investmentID: investmentID },
                skip: (page - 1) * pageRange,
                take: pageRange,
            });
            return userInvestmentList;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.filterPrismaUserInvestmentsByInvestmentID = filterPrismaUserInvestmentsByInvestmentID;
function deletePrismaUserInvestments(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const userInvestmentDeleted = yield prisma_1.prisma.userInvestment.delete({ where: { id: id } });
            return userInvestmentDeleted;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.deletePrismaUserInvestments = deletePrismaUserInvestments;
function validatePageParams(listUserInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { page, pageRange } = listUserInvestmentData;
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
