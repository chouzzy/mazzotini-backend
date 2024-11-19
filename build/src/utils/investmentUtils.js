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
exports.validatePageParams = exports.filterPrismaInvestmentByID = exports.deletePrismaInvestment = exports.updatePrismaInvestment = exports.filterPrismaInvestment = exports.createPrismaInvestment = void 0;
const prisma_1 = require("../prisma");
function createPrismaInvestment(investmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            investmentData.launchDate = new Date(investmentData.launchDate);
            investmentData.constructionStartDate = new Date(investmentData.constructionStartDate);
            investmentData.expectedDeliveryDate = new Date(investmentData.expectedDeliveryDate);
            if (investmentData.finishDate) {
                investmentData.finishDate = new Date(investmentData.finishDate);
            }
            else {
                investmentData.finishDate = new Date('2030-12-12');
            }
            investmentData.investmentDate = new Date(investmentData.investmentDate);
            const titleExists = yield prisma_1.prisma.investment.findFirst({
                where: { title: investmentData.title }
            });
            if (titleExists) {
                throw Error("Título já existente.");
            }
            const createdInvestment = yield prisma_1.prisma.investment.create({
                data: investmentData
            });
            return createdInvestment;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.createPrismaInvestment = createPrismaInvestment;
function filterPrismaInvestmentByID(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(id);
            // Query com todos os dados
            const investment = yield prisma_1.prisma.investment.findUnique({
                where: { id }
            });
            return investment;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    });
}
exports.filterPrismaInvestmentByID = filterPrismaInvestmentByID;
function filterPrismaInvestment(listInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { title, investmentValue, companyName, expectedDeliveryDateInitial, expectedDeliveryDateFinal, city, page, pageRange } = listInvestmentData;
            // Sem filtros, só paginação
            if (!title &&
                !investmentValue &&
                !companyName &&
                !expectedDeliveryDateInitial &&
                !expectedDeliveryDateFinal &&
                !city) {
                const filteredInvestment = yield prisma_1.prisma.investment.findMany({
                    skip: (page - 1) * pageRange,
                    take: pageRange,
                });
                return filteredInvestment;
            }
            // Modelagem de datas
            let expectedDeliveryDateInitialISO;
            if (expectedDeliveryDateInitial) {
                expectedDeliveryDateInitialISO = new Date(expectedDeliveryDateInitial).toISOString();
            }
            let expectedDeliveryDateFinalISO;
            if (expectedDeliveryDateFinal) {
                expectedDeliveryDateFinalISO = new Date(expectedDeliveryDateFinal).toISOString();
            }
            // Query para usar no FindMany
            const andConditions = [
                { title },
                { investmentValue },
                { companyName },
                {
                    expectedDeliveryDate: {
                        gte: expectedDeliveryDateInitial ? expectedDeliveryDateInitialISO : undefined,
                        lte: expectedDeliveryDateFinal ? expectedDeliveryDateFinalISO : undefined,
                    },
                },
            ];
            // Condição para filtrar por Cidade (caso City não exista)
            if (city) {
                andConditions.push({
                    address: {
                        city: city,
                    },
                });
            }
            // Query com todos os dados
            const filteredInvestment = yield prisma_1.prisma.investment.findMany({
                where: {
                    AND: andConditions
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
exports.filterPrismaInvestment = filterPrismaInvestment;
function updatePrismaInvestment(investmentData, id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const investmentExists = yield prisma_1.prisma.investment.findFirst({
                where: { id }
            });
            if (!investmentExists) {
                throw Error("O empreendimento informado não existe.");
            }
            const updatedInvestment = yield prisma_1.prisma.investment.update({
                where: { id },
                data: investmentData
            });
            return updatedInvestment;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.updatePrismaInvestment = updatePrismaInvestment;
function deletePrismaInvestment(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const investmentExists = yield prisma_1.prisma.investment.findFirst({
                where: { id }
            });
            if (!investmentExists) {
                throw Error("O empreendimento informado não existe.");
            }
            const deletedInvestment = yield prisma_1.prisma.investment.delete({ where: { id } });
            return deletedInvestment;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.deletePrismaInvestment = deletePrismaInvestment;
function validatePageParams(listInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { page, pageRange } = listInvestmentData;
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
