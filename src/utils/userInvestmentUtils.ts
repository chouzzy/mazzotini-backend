import { CreateUserInvestmentRequestProps } from "../modules/investments/useCases/UserInvestment/createUserInvestment/CreateUserInvestmentController";
import { ListUserInvestmentRequestProps } from "../modules/investments/useCases/UserInvestment/listUserInvestments/ListUserInvestmentsController";
import { ListUserInvestmentFormatted } from "../modules/investments/useCases/UserInvestment/listUserInvestments/ListUserInvestmentsUseCase";
import { prisma } from "../prisma";


async function createPrismaUserInvestment(userInvestmentData: CreateUserInvestmentRequestProps) {

    try {

        const { userID, investmentID, investedValue } = userInvestmentData

        const userInvestment = await prisma.userInvestment.create({
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
                investedValue: investedValue
            }
        })

        return userInvestment

    } catch (error) {
        throw error
    }
}
async function filterPrismaUserInvestment(listUserInvestmentData: ListUserInvestmentFormatted) {

    try {

        const { userID, investmentID, page, pageRange } = listUserInvestmentData


        if (!userID && !investmentID) {

            const userInvestment = await prisma.userInvestment.findMany({
                skip: (page - 1) * pageRange,
                take: pageRange,
            })

            return userInvestment
        }


        const userInvestment = await prisma.userInvestment.findMany({
            where: {
                AND: [
                    { userID },
                    { investmentID }
                ]
            },
            skip: (page - 1) * pageRange,
            take: pageRange,
        })

        return userInvestment

    } catch (error) {
        throw error
    }
}

async function filterPrismaInvestmentsByUserID(listUserInvestmentData: ListUserInvestmentFormatted) {

    try {

        const { userID, page, pageRange } = listUserInvestmentData

        // PEGA A LISTA DE INVESTIMENTOS DESSE USUARIO
        const userInvestmentList = await prisma.userInvestment.findMany({
            where: { userID: userID },
            skip: (page - 1) * pageRange,
            take: pageRange,
        })

        // LISTA OS IDS DO INVESTIMENTO
        const investmentIDs = userInvestmentList.map((userInvestment) => { return userInvestment.investmentID })

        // FILTRA TODOS OS INVESTIMENTOS QUE POSSUEM OS IDS ENCONTRADOS
        const investments = await prisma.investment.findMany({
            where: {
                id: {
                    in: investmentIDs, // Filtra os investimentos com base na lista de IDs
                },
            },
        });

        return investments




    } catch (error) {
        throw error
    }
}

async function filterPrismaInvestmentsByInvestmentID(listUserInvestmentData: ListUserInvestmentFormatted) {

    try {

        const { investmentID, page, pageRange } = listUserInvestmentData

        // PEGA A LISTA DE INVESTIMENTOS DESSE USUARIO
        const userInvestmentList = await prisma.userInvestment.findMany({
            where: { investmentID: investmentID },
            skip: (page - 1) * pageRange,
            take: pageRange,
        })

        // LISTA OS IDS DO INVESTIMENTO
        const userIDs = userInvestmentList.map((userInvestment) => { return userInvestment.userID })

        // FILTRA TODOS OS INVESTIMENTOS QUE POSSUEM OS IDS ENCONTRADOS
        const users = await prisma.users.findMany({
            where: {
                id: {
                    in: userIDs, // Filtra os investimentos com base na lista de IDs
                },
            },
        });

        return users

    } catch (error) {
        throw error
    }
}


async function validatePageParams(listUserInvestmentData: ListUserInvestmentRequestProps) {

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
    } catch (error) {
        throw error;
    }
}

export { createPrismaUserInvestment, filterPrismaUserInvestment, filterPrismaInvestmentsByUserID, filterPrismaInvestmentsByInvestmentID, validatePageParams }