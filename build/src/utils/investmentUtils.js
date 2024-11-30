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
exports.importPrismaInvestmentProgress = exports.deletePrismaInvestmentPartner = exports.deletePrismaInvestmentDocument = exports.validatePageParams = exports.deletePrismaInvestmentImage = exports.filterPrismaInvestmentByID = exports.deletePrismaInvestment = exports.updatePrismaInvestment = exports.filterPrismaInvestment = exports.createPrismaInvestment = void 0;
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
            const { investmentDate } = investmentData;
            if (investmentDate) {
                investmentData.investmentDate = new Date(investmentDate);
            }
            const titleExists = yield prisma_1.prisma.investment.findFirst({
                where: { title: investmentData.title }
            });
            if (titleExists) {
                throw Error("Título já existente.");
            }
            console.log('investmentData');
            console.log(investmentData);
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
            // Query com todos os dados
            const investment = yield prisma_1.prisma.investment.findUnique({
                where: { id }
            });
            return investment;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.filterPrismaInvestmentByID = filterPrismaInvestmentByID;
function filterPrismaInvestment(listInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { title, investmentValue, companyName, expectedDeliveryDateInitial, expectedDeliveryDateFinal, city, projectManagerID, active, page, pageRange } = listInvestmentData;
            // Sem filtros, só paginação
            if (!title &&
                !investmentValue &&
                !companyName &&
                !expectedDeliveryDateInitial &&
                !expectedDeliveryDateFinal &&
                !city &&
                !projectManagerID &&
                !active) {
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
                { projectManagerID },
                { active },
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
                orderBy: [
                    {
                        title: 'asc'
                    }
                ]
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
            const { launchDate, constructionStartDate, expectedDeliveryDate } = investmentData;
            // Modelagem de datas
            if (launchDate) {
                investmentData.launchDate = new Date(launchDate);
            }
            if (constructionStartDate) {
                investmentData.constructionStartDate = new Date(constructionStartDate);
            }
            if (expectedDeliveryDate) {
                investmentData.expectedDeliveryDate = new Date(expectedDeliveryDate);
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
function deletePrismaInvestmentImage(investmentID, id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const investmentExists = yield prisma_1.prisma.investment.findFirst({
                where: { id: investmentID }
            });
            if (!investmentExists) {
                throw Error("O empreendimento informado não existe.");
            }
            const updatedInvestment = yield prisma_1.prisma.investment.update({
                where: { id: investmentID },
                data: {
                    images: {
                        deleteMany: {
                            where: { id: id },
                        },
                    },
                },
            });
            return updatedInvestment.images;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.deletePrismaInvestmentImage = deletePrismaInvestmentImage;
function deletePrismaInvestmentDocument(investmentID, id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const investmentExists = yield prisma_1.prisma.investment.findFirst({
                where: { id: investmentID }
            });
            if (!investmentExists) {
                throw Error("O empreendimento informado não existe.");
            }
            const updatedInvestment = yield prisma_1.prisma.investment.update({
                where: { id: investmentID },
                data: {
                    documents: {
                        deleteMany: {
                            where: { id: id },
                        },
                    },
                },
            });
            console.log(updatedInvestment.documents);
            return updatedInvestment.documents;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.deletePrismaInvestmentDocument = deletePrismaInvestmentDocument;
function deletePrismaInvestmentPartner(investmentID, id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const investmentExists = yield prisma_1.prisma.investment.findFirst({
                where: { id: investmentID }
            });
            if (!investmentExists) {
                throw Error("O empreendimento informado não existe.");
            }
            const updatedInvestment = yield prisma_1.prisma.investment.update({
                where: { id: investmentID },
                data: {
                    partners: {
                        deleteMany: {
                            where: { id: id },
                        },
                    },
                },
            });
            console.log(updatedInvestment.partners);
            return updatedInvestment.partners;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.deletePrismaInvestmentPartner = deletePrismaInvestmentPartner;
function importPrismaInvestmentProgress(worksheet, id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const investmentExists = yield prisma_1.prisma.investment.findFirst({
                where: { id: id }
            });
            if (!investmentExists) {
                throw Error("O empreendimento informado não existe.");
            }
            const financialTotalProgress = [];
            const buildingTotalProgress = [];
            // Começa da segunda linha, pois a primeira linha é o cabeçalho
            for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
                const row = worksheet.getRow(rowNumber);
                // Extrai os dados da linha
                const data = row.getCell(1).value; // Se o valor for null ou undefined, define como string vazia
                const financeiroPrevisto = Math.round(parseFloat(parseFloat(row.getCell(2).text).toFixed(2)));
                const financeiroRealizado = Math.round(parseFloat(parseFloat(row.getCell(3).text).toFixed(2)));
                const obraPrevisto = parseFloat(parseFloat(row.getCell(4).text.replace('%', '')).toFixed(2));
                const obraRealizado = parseFloat(parseFloat(row.getCell(5).text.replace('%', '')).toFixed(2));
                // Adiciona os dados aos arrays
                financialTotalProgress.push({
                    data: data,
                    previsto: financeiroPrevisto,
                    realizado: financeiroRealizado,
                });
                buildingTotalProgress.push({
                    data: data,
                    previsto: obraPrevisto,
                    realizado: obraRealizado,
                });
            }
            const updatedInvestment = yield prisma_1.prisma.investment.update({
                where: { id: id },
                data: {
                    financialTotalProgress: financialTotalProgress,
                    buildingTotalProgress: buildingTotalProgress
                }
            });
            return (updatedInvestment);
        }
        catch (error) {
            throw error;
        }
    });
}
exports.importPrismaInvestmentProgress = importPrismaInvestmentProgress;
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
