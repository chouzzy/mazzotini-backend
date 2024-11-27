import { Request, Response } from "express";
import { checkQuery } from "./ListInvestmentsCheck";
import { InvestmentEntity } from "../../../entities/Investments";
import { InvestmentRepository } from "../../../repositories/implementations/InvestmentRepository";
import { ListInvestmentUseCase } from "./ListInvestmentsUseCase";
import { Prisma } from "@prisma/client";

interface ListInvestmentRequestProps {
    title?: InvestmentEntity["title"];
    investmentValue?: InvestmentEntity["investmentValue"];
    companyName?: InvestmentEntity["companyName"];
    expectedDeliveryDateInitial?: InvestmentEntity["expectedDeliveryDate"];
    expectedDeliveryDateFinal?: InvestmentEntity["expectedDeliveryDate"];
    city?: InvestmentEntity["address"]["city"];
    projectManagerID?: InvestmentEntity["projectManagerID"];
    active?: string|boolean;
    page?: string;
    pageRange?: string;
}

class ListInvestmentsController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {
            const listInvestmentData: ListInvestmentRequestProps = req.query

            console.log(listInvestmentData)
            
            if (listInvestmentData.active === 'true') {listInvestmentData.active = true}
            if (listInvestmentData.active === 'false') {listInvestmentData.active = false}
            
            const { investmentValue } = listInvestmentData

            if (investmentValue) {

                listInvestmentData.investmentValue = Number(listInvestmentData.investmentValue)

                if (typeof (listInvestmentData.investmentValue) == 'number') {
                    throw Error('investmentValue deve ser number')
                }
            }

            await checkQuery(listInvestmentData)

            // Instanciando o useCase no repositório com as funções
            const investmentRepository = new InvestmentRepository()

            const listUsersUseCase = new ListInvestmentUseCase(investmentRepository);

            const investments = await listUsersUseCase.execute(listInvestmentData)

            return res.status(200).json({
                successMessage: "Investimentos listados com sucesso!",
                investments: investments
            })

        } catch (error) {

            if (error instanceof Prisma.PrismaClientValidationError) {
                return res.status(401).json({
                    error: {
                        name: error.name,
                        message: error.message,
                    }
                })

            } else {
                return res.status(401).json({ error: { name: 'ListInvestmentsController error: C2DI API', message: String(error) } })
            }
        }
    }
}

export { ListInvestmentsController, ListInvestmentRequestProps }