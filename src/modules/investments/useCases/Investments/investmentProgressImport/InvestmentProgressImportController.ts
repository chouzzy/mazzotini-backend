import { InvestmentEntity } from "../../../entities/Investments"
import { Request, Response } from "express"
import { InvestmentRepository } from "../../../repositories/implementations/InvestmentRepository"
import { Prisma } from "@prisma/client"
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import * as exceljs from 'exceljs';
import { checkWorksheet } from "./InvestmentProgressImportCheck";
import { InvestmentProgressImportUseCase } from "./InvestmentProgressImportUseCase";


class ProjectProgressInvestmentPartnerController {
    async handle(req: Request, res: Response): Promise<any> {

        try {

            const {id} = req.params

            if (!id) { throw Error("ID ausente")}

            const form = formidable({});

            form.parse(req, async (err, fields, files: any) => {
                if (err) {
                    throw err
                }
                const file = files.file[0]; // Obtém o arquivo da planilha
                const workbook = new exceljs.Workbook();
                await workbook.xlsx.readFile(file.filepath);
                const worksheet = workbook.worksheets[0];

                await checkWorksheet(worksheet)

                const investmentRepository = new InvestmentRepository()
                const investmentProgressImportUseCase = new InvestmentProgressImportUseCase(investmentRepository)
                const investment = await investmentProgressImportUseCase.execute(worksheet, id)

                return res.status(200).json({
                    successMessage: "Dados de progresso atualizados com sucesso!",
                    investment: investment
                })
            });


        } catch (error) {

            if (error instanceof Prisma.PrismaClientValidationError) {

                console.log(error)
                return res.status(401).json({
                    error: {
                        name: error.name,
                        message: error.message,
                    }
                })

            } else {
                console.log(error)
                return res.status(401).json({ error: { name: 'CreateInvestmentsController error: C2DI API', message: String(error) } })
            }
        }

    }
}

export { ProjectProgressInvestmentPartnerController }