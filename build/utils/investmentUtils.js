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
exports.validatePageParams = exports.filterPrismaInvestment = exports.createPrismaInvestment = void 0;
const prisma_1 = require("../prisma");
function createPrismaInvestment(investmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { title, description, investmentValue, companyName, finishDate, buildingStatus, investmentDate } = investmentData;
            const createdInvestment = yield prisma_1.prisma.investment.create({
                data: {
                    title,
                    description,
                    investmentValue,
                    companyName,
                    finishDate,
                    buildingStatus,
                    investmentDate,
                }
            });
            return createdInvestment;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.createPrismaInvestment = createPrismaInvestment;
function filterPrismaInvestment(listInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { title, buildingStatus, companyName, description, finishDateInitial, investmentDateInitial, finishDateFinal, investmentDateFinal, investmentValue, page, pageRange } = listInvestmentData;
            if (!title &&
                !buildingStatus &&
                !companyName &&
                !description &&
                !finishDateInitial &&
                !investmentDateInitial &&
                !finishDateFinal &&
                !investmentDateFinal &&
                !investmentValue) {
                const filteredInvestment = yield prisma_1.prisma.investment.findMany({
                    skip: (page - 1) * pageRange,
                    take: pageRange,
                });
                return filteredInvestment;
            }
            let investmentDateInitialISO;
            if (investmentDateInitial) {
                investmentDateInitialISO = new Date(investmentDateInitial).toISOString();
            }
            let investmentDateFinalISO;
            if (investmentDateFinal) {
                investmentDateFinalISO = new Date(investmentDateFinal).toISOString();
            }
            let finishDateInitialISO;
            if (finishDateInitial) {
                finishDateInitialISO = new Date(finishDateInitial).toISOString();
            }
            let finishDateFinalISO;
            if (finishDateFinal) {
                finishDateFinalISO = new Date(finishDateFinal).toISOString();
            }
            const filteredInvestment = yield prisma_1.prisma.investment.findMany({
                where: {
                    AND: [
                        { title },
                        { buildingStatus },
                        { companyName },
                        { description },
                        {
                            finishDate: {
                                gte: finishDateInitial ? finishDateInitialISO : undefined,
                                lte: finishDateFinal ? finishDateFinalISO : undefined
                            }
                        },
                        {
                            investmentDate: {
                                gte: investmentDateInitial ? investmentDateInitialISO : undefined,
                                lte: investmentDateFinal ? investmentDateFinalISO : undefined,
                            }
                        },
                        { investmentValue }
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
exports.filterPrismaInvestment = filterPrismaInvestment;
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
