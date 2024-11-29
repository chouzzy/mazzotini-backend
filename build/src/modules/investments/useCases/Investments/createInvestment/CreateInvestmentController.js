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
exports.CreateInvestmentsController = void 0;
const InvestmentRepository_1 = require("../../../repositories/implementations/InvestmentRepository");
const CreateInvestmentUseCase_1 = require("./CreateInvestmentUseCase");
const CreateInvestmentCheck_1 = require("./CreateInvestmentCheck");
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
class CreateInvestmentsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const investmentData = req.body;
                const { partners, documents, images } = investmentData;
                if (partners) {
                    partners.map((partner) => {
                        partner.id = (0, uuid_1.v4)();
                    });
                }
                if (documents) {
                    documents.map((doc) => {
                        doc.id = (0, uuid_1.v4)();
                    });
                }
                if (images) {
                    images.map((img) => {
                        img.id = (0, uuid_1.v4)();
                    });
                }
                yield (0, CreateInvestmentCheck_1.checkBody)(investmentData);
                /// instanciação da classe do caso de uso
                const investmentRepository = new InvestmentRepository_1.InvestmentRepository();
                const createInvestmentUseCase = new CreateInvestmentUseCase_1.CreateInvestmentUseCase(investmentRepository);
                const investment = yield createInvestmentUseCase.execute(investmentData);
                return res.status(200).json({
                    successMessage: "Investimentos listados com sucesso!",
                    investment: investment
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
exports.CreateInvestmentsController = CreateInvestmentsController;
