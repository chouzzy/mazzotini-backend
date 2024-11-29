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
exports.ProjectProgressInvestmentPartnerController = void 0;
const client_1 = require("@prisma/client");
class ProjectProgressInvestmentPartnerController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // const form = formidable({ multiples: true });
                const importData = req.body;
                // await checkBody(investmentData)
                /// instanciação da classe do caso de uso
                // const investmentRepository = new InvestmentRepository()
                // const createInvestmentUseCase = new CreateInvestmentUseCase(investmentRepository)
                // const investment = await createInvestmentUseCase.execute(investmentData)
                return res.status(200).json({
                    successMessage: "Investimentos listados com sucesso!",
                    // investment: investment
                });
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientValidationError) {
                    console.log(error);
                    return res.status(401).json({
                        error: {
                            name: error.name,
                            message: error.message,
                        }
                    });
                }
                else {
                    console.log(error);
                    return res.status(401).json({ error: { name: 'CreateInvestmentsController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.ProjectProgressInvestmentPartnerController = ProjectProgressInvestmentPartnerController;
