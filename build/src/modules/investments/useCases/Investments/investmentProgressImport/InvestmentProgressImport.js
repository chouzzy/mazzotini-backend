"use strict";
// import { InvestmentEntity } from "../../../entities/Investments"
// import { Request, Response } from "express"
// import { InvestmentRepository } from "../../../repositories/implementations/InvestmentRepository"
// import { CreateInvestmentUseCase } from "./InvestmentProgressImportUseCase"
// import { checkBody } from "./InvestmentProgressImportCheck"
// import { Prisma } from "@prisma/client"
// import { v4 as uuidv4 } from 'uuid';
// interface ProjectProgressInvestmentPartnerRequestProps {
// }
// class ProjectProgressInvestmentPartnerController {
//     async handle(req: Request, res: Response): Promise<Response> {
//         try {
//             const form = formidable({ multiples: true });
//             const importData: ProjectProgressInvestmentPartnerRequestProps = req.body
//             // await checkBody(investmentData)
//             /// instanciação da classe do caso de uso
//             const investmentRepository = new InvestmentRepository()
//             const createInvestmentUseCase = new CreateInvestmentUseCase(investmentRepository)
//             const investment = await createInvestmentUseCase.execute(investmentData)
//             return res.status(200).json({
//                 successMessage: "Investimentos listados com sucesso!",
//                 investment: investment
//             })
//         } catch (error) {
//             if (error instanceof Prisma.PrismaClientValidationError) {
//                 console.log(error)
//                 return res.status(401).json({
//                     error: {
//                         name: error.name,
//                         message: error.message,
//                     }
//                 })
//             } else {
//                 console.log(error)
//                 return res.status(401).json({ error: { name: 'CreateInvestmentsController error: C2DI API', message: String(error) } })
//             }
//         }
//     }
// }
// export { ProjectProgressInvestmentPartnerController, CreateInvestmentRequestProps }
