import { Investment, Users, UserInvestment } from "@prisma/client";
import { prisma } from "../../../../prisma";
import { validationResponse } from "../../../../types";
import { createPrismaUserInvestment, deletePrismaUserInvestments, filterPrismaInvestmentsByInvestmentID, filterPrismaInvestmentsByUserID, filterPrismaUserInvestment, filterPrismaUserInvestmentsByInvestmentID } from "../../../../utils/userInvestmentUtils";
import { UserInvestmentEntity } from "../../entities/UserInvestment";
import { CreateUserInvestmentRequestProps } from "../../useCases/UserInvestment/createUserInvestment/CreateUserInvestmentController";
import { ListUserInvestmentRequestProps } from "../../useCases/UserInvestment/listUserInvestments/ListUserInvestmentsController";
import { ListUserInvestmentFormatted } from "../../useCases/UserInvestment/listUserInvestments/ListUserInvestmentsUseCase";
import { IUserInvestmentRepository } from "../IUserInvestmentRepository";



class UserInvestmentRepository implements IUserInvestmentRepository {

    private userInvestment: UserInvestmentEntity[]
    constructor() {
        this.userInvestment = [];
    }

    async filterUserInvestment(listUserInvestmentData: ListUserInvestmentFormatted): Promise<Investment[] | Users[] | UserInvestment[] | undefined> {

        try {

            const { userID, investmentID } = listUserInvestmentData

            if (userID && !investmentID) {

                const filteredInvestmentsByUserID = await filterPrismaInvestmentsByUserID(listUserInvestmentData)

                return filteredInvestmentsByUserID
            }

            if (!userID && investmentID) {

                const filteredUsersByInvestmentIDs = await filterPrismaInvestmentsByInvestmentID(listUserInvestmentData)

                return filteredUsersByInvestmentIDs
            }
            if (!userID && !investmentID) {

                const allUserInvestments = await filterPrismaUserInvestment(listUserInvestmentData)

                return allUserInvestments
            }


        } catch (error) {
            throw error
        }
    }


    async filterUserInvestmentByInvestmentID(listUserInvestmentData: ListUserInvestmentFormatted): Promise<UserInvestment[]> {

        try {

            const { userID, investmentID } = listUserInvestmentData

            if (!investmentID) {
                throw Error("ID do investimento inválido")
            }

            const filteredUsersByInvestmentIDs = await filterPrismaUserInvestmentsByInvestmentID(listUserInvestmentData)

            return filteredUsersByInvestmentIDs


        } catch (error) {
            throw error
        }
    }

    async createUserInvestment(userInvestmentData: CreateUserInvestmentRequestProps): Promise<validationResponse> {

        const userInvestment = await createPrismaUserInvestment(userInvestmentData)

        return {
            isValid: true,
            statusCode: 202,
            successMessage: 'Created investment.',
            userInvestment: userInvestment
        }
    }


    async deleteUserInvestment(id:UserInvestmentEntity["id"]): Promise<UserInvestment> {

        const userInvestmentDeleted = await deletePrismaUserInvestments(id)

        return userInvestmentDeleted
    }
}

export { UserInvestmentRepository }
