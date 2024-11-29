import { InvestmentEntity } from "../../../entities/Investments"
import { Request, Response } from "express"
import { InvestmentRepository } from "../../../repositories/implementations/InvestmentRepository"
import { Prisma } from "@prisma/client"
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import * as exceljs from 'exceljs';


interface ProjectProgressInvestmentPartnerRequestProps {

}

class ProjectProgressInvestmentPartnerController {
    async handle(req: Request, res: Response): Promise<any> {

        const form = formidable({});

        form.parse(req, async (err, fields, files:any) => {
            if (err) {
                // next(err);
                console.error('oii')
                return;
            }
            const file = files.file[0]; // Obtém o arquivo da planilha
            const workbook = new exceljs.Workbook();
            await workbook.xlsx.readFile(file.filepath);
            const worksheet = workbook.worksheets[0];
            console.log('excel:')
            console.log(worksheet.getCell('A1').value)
            console.log(worksheet.getCell('B1').value)
            console.log(worksheet.getCell('C1').value)
            console.log(worksheet.getCell('D1').value)
            console.log(worksheet.getCell('E1').value)
            res.json({ fields, files });
        });

        // try {
        //     console.log('simmmmmmmmmmmmm')

        //     const form = formidable({ multiples: true });


        //     form.parse(req, async (err, fields, files: any) => {
        //         if (err) {
        //             console.error('Erro ao fazer o upload do arquivo:', err);
        //             return res.status(500).json({ error: 'Erro ao fazer o upload do arquivo' })

        //         }

        //         console.log('aqui')
        //         const file = files.file[0]; // Obtém o arquivo da planilha
        //         const workbook = new exceljs.Workbook();
        //         await workbook.xlsx.readFile(file.filepath);

        //         // ... (lógica para processar os dados da planilha) ...

        //         // Exemplo de como acessar os dados da planilha:
        //         const worksheet = workbook.worksheets[0];
        //         console.log('excel:')
        //         console.log(worksheet.getCell('A1').value)
        //         console.log(worksheet.getCell('B1').value)
        //         console.log(worksheet.getCell('C1').value)
        //         console.log(worksheet.getCell('D1').value)
        //         console.log(worksheet.getCell('E1').value)

        //     });

        //     // await checkBody(investmentData)

        //     /// instanciação da classe do caso de uso
        //     // const investmentRepository = new InvestmentRepository()
        //     // const createInvestmentUseCase = new CreateInvestmentUseCase(investmentRepository)
        //     // const investment = await createInvestmentUseCase.execute(investmentData)



        // } catch (error) {

        //     if (error instanceof Prisma.PrismaClientValidationError) {

        //         console.log(error)
        //         return res.status(401).json({
        //             error: {
        //                 name: error.name,
        //                 message: error.message,
        //             }
        //         })

        //     } else {
        //         console.log(error)
        //         return res.status(401).json({ error: { name: 'CreateInvestmentsController error: C2DI API', message: String(error) } })
        //     }
        // }

    }
}

export { ProjectProgressInvestmentPartnerController }