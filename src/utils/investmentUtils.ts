import { Worksheet } from "exceljs";
import { InvestmentEntity } from "../modules/investments/entities/Investments";
import { CreateInvestmentRequestProps } from "../modules/investments/useCases/Investments/createInvestment/CreateInvestmentController";
import { ListInvestmentRequestProps } from "../modules/investments/useCases/Investments/listInvestment/ListInvestmentsController";
import { ListInvestmentProps } from "../modules/investments/useCases/Investments/listInvestment/ListInvestmentsUseCase";
import { UpdateInvestmentRequestProps } from "../modules/investments/useCases/Investments/updateInvestment/UpdateInvestmentController";
import { prisma } from "../prisma";
import { Investment } from "@prisma/client";


async function createPrismaInvestment(investmentData: CreateInvestmentRequestProps) {

    try {

        investmentData.launchDate = new Date(investmentData.launchDate)
        investmentData.constructionStartDate = new Date(investmentData.constructionStartDate)
        investmentData.expectedDeliveryDate = new Date(investmentData.expectedDeliveryDate)

        if (investmentData.finishDate) {

            investmentData.finishDate = new Date(investmentData.finishDate)
        } else {
            investmentData.finishDate = new Date('2030-12-12')

        }

        const { investmentDate } = investmentData

        if (investmentDate) {
            investmentData.investmentDate = new Date(investmentDate)
        }

        const titleExists = await prisma.investment.findFirst({
            where: { title: investmentData.title }
        })

        if (titleExists) {
            throw Error("Título já existente.")
        }

        console.log('investmentData')
        console.log(investmentData)

        const { buildingTotalProgress, financialTotalProgress, buildingProgress } = investmentData
        if (!buildingTotalProgress) { investmentData.buildingTotalProgress = [{ data: new Date(), previsto: 0, realizado: 0 }] }
        if (!financialTotalProgress) { investmentData.financialTotalProgress = [{ data: new Date(), previsto: 0, realizado: 0 }] }
        
        if (!buildingProgress) {
            investmentData.buildingProgress = {
                acabamento: 0,
                alvenaria: 0,
                estrutura: 0,
                fundacao: 0,
                instalacoes: 0,
                pintura: 0
            }
        }

        const createdInvestment = await prisma.investment.create({
            data: investmentData
        })

        return createdInvestment

    } catch (error) {
        throw error
    }

}

async function filterPrismaInvestmentByID(id: InvestmentEntity["id"]) {

    try {

        // Query com todos os dados
        const investment = await prisma.investment.findUnique({
            where: { id }
        })

        return investment

    } catch (error) {
        throw error
    }

}

async function filterPrismaInvestment(listInvestmentData: ListInvestmentProps) {

    try {

        const {
            title,
            investmentValue,
            companyName,
            expectedDeliveryDateInitial,
            expectedDeliveryDateFinal,
            city,
            projectManagerID,
            active,
            page,
            pageRange
        } = listInvestmentData


        // Sem filtros, só paginação
        if (
            !title &&
            !investmentValue &&
            !companyName &&
            !expectedDeliveryDateInitial &&
            !expectedDeliveryDateFinal &&
            !city &&
            !projectManagerID &&
            !active
        ) {

            const filteredInvestment = await prisma.investment.findMany({
                skip: (page - 1) * pageRange,
                take: pageRange,
            })

            return filteredInvestment
        }

        // Modelagem de datas
        let expectedDeliveryDateInitialISO
        if (expectedDeliveryDateInitial) { expectedDeliveryDateInitialISO = new Date(expectedDeliveryDateInitial).toISOString() }

        let expectedDeliveryDateFinalISO
        if (expectedDeliveryDateFinal) { expectedDeliveryDateFinalISO = new Date(expectedDeliveryDateFinal).toISOString() }

        // Query para usar no FindMany
        const andConditions: any = [
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
        const filteredInvestment = await prisma.investment.findMany({
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
        })

        return filteredInvestment

    } catch (error) {
        throw error
    }

}

async function updatePrismaInvestment(investmentData: UpdateInvestmentRequestProps, id: InvestmentEntity["id"]) {

    try {

        const investmentExists = await prisma.investment.findFirst({
            where: { id }
        })

        if (!investmentExists) {
            throw Error("O empreendimento informado não existe.")
        }

        const { launchDate, constructionStartDate, expectedDeliveryDate } = investmentData
        // Modelagem de datas
        if (launchDate) { investmentData.launchDate = new Date(launchDate) }
        if (constructionStartDate) { investmentData.constructionStartDate = new Date(constructionStartDate) }
        if (expectedDeliveryDate) { investmentData.expectedDeliveryDate = new Date(expectedDeliveryDate) }

        const updatedInvestment = await prisma.investment.update({
            where: { id },
            data: investmentData
        })

        return updatedInvestment

    } catch (error) {
        throw error
    }
}

async function deletePrismaInvestment(id: InvestmentEntity["id"]) {

    try {

        const investmentExists = await prisma.investment.findFirst({
            where: { id }
        })

        if (!investmentExists) {
            throw Error("O empreendimento informado não existe.")
        }

        const deletedInvestment = await prisma.investment.delete({ where: { id } })

        return deletedInvestment

    } catch (error) {
        throw error
    }
}

async function deletePrismaInvestmentImage(investmentID: InvestmentEntity["id"], id: InvestmentEntity["images"][0]["id"]) {

    try {

        const investmentExists = await prisma.investment.findFirst({
            where: { id: investmentID }
        })

        if (!investmentExists) {
            throw Error("O empreendimento informado não existe.")
        }

        const updatedInvestment = await prisma.investment.update({
            where: { id: investmentID },
            data: {
                images: {
                    deleteMany: {
                        where: { id: id },
                    },
                },
            },
        });

        return updatedInvestment.images

    } catch (error) {
        throw error
    }
}

async function deletePrismaInvestmentDocument(investmentID: InvestmentEntity["id"], id: InvestmentEntity["documents"][0]["id"]) {

    try {

        const investmentExists = await prisma.investment.findFirst({
            where: { id: investmentID }
        })

        if (!investmentExists) {
            throw Error("O empreendimento informado não existe.")
        }

        const updatedInvestment = await prisma.investment.update({
            where: { id: investmentID },
            data: {
                documents: {
                    deleteMany: {
                        where: { id: id },
                    },
                },
            },
        });

        console.log(updatedInvestment.documents)

        return updatedInvestment.documents

    } catch (error) {
        throw error
    }
}


async function deletePrismaInvestmentPartner(investmentID: InvestmentEntity["id"], id: InvestmentEntity["partners"][0]["id"]) {

    try {

        const investmentExists = await prisma.investment.findFirst({
            where: { id: investmentID }
        })

        if (!investmentExists) {
            throw Error("O empreendimento informado não existe.")
        }

        const updatedInvestment = await prisma.investment.update({
            where: { id: investmentID },
            data: {
                partners: {
                    deleteMany: {
                        where: { id: id },
                    },
                },
            },
        });

        console.log(updatedInvestment.partners)

        return updatedInvestment.partners

    } catch (error) {
        throw error
    }
}

async function importPrismaInvestmentProgress(worksheet: Worksheet, id: Investment["id"]) {

    try {

        const investmentExists = await prisma.investment.findFirst({
            where: { id: id }
        })

        if (!investmentExists) {
            throw Error("O empreendimento informado não existe.")
        }


        const financialTotalProgress: Investment["financialTotalProgress"] = [];
        const buildingTotalProgress: Investment["buildingTotalProgress"] = [];

        // Começa da segunda linha, pois a primeira linha é o cabeçalho
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            // Extrai os dados da linha
            const data = row.getCell(1).value as Date; // Se o valor for null ou undefined, define como string vazia
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

        const updatedInvestment = await prisma.investment.update({
            where: { id: id },
            data: {
                financialTotalProgress: financialTotalProgress,
                buildingTotalProgress: buildingTotalProgress
            }
        })

        return (updatedInvestment)

    } catch (error) {
        throw error
    }
}


async function validatePageParams(listInvestmentData: ListInvestmentRequestProps) {

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
    } catch (error) {
        throw error;
    }
}

export { createPrismaInvestment, filterPrismaInvestment, updatePrismaInvestment, deletePrismaInvestment, filterPrismaInvestmentByID, deletePrismaInvestmentImage, validatePageParams, deletePrismaInvestmentDocument, deletePrismaInvestmentPartner, importPrismaInvestmentProgress }