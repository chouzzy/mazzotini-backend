import { CreateUserInvestmentRequestProps } from "../modules/investments/useCases/UserInvestment/createUserInvestment/CreateUserInvestmentController";
import { ListUserInvestmentRequestProps } from "../modules/investments/useCases/UserInvestment/listUserInvestments/ListUserInvestmentsController";
import { ListUserInvestmentFormatted } from "../modules/investments/useCases/UserInvestment/listUserInvestments/ListUserInvestmentsUseCase";
import { prisma } from "../prisma";


async function createPrismaUserInvestment(userInvestmentData: CreateUserInvestmentRequestProps) {

    try {

        const { userID, investmentID } = userInvestmentData

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
                }
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

export { createPrismaUserInvestment, filterPrismaUserInvestment, validatePageParams }