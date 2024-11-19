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
exports.GetInvestmentByIDController = void 0;
const InvestmentRepository_1 = require("../../../repositories/implementations/InvestmentRepository");
const GetInvestmentByIDUseCase_1 = require("./GetInvestmentByIDUseCase");
const client_1 = require("@prisma/client");
const GetInvestmentByIDCheck_1 = require("./GetInvestmentByIDCheck");
class GetInvestmentByIDController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (typeof (id) != 'string') {
                    throw Error("O id deve ser uma string");
                }
                yield (0, GetInvestmentByIDCheck_1.checkQuery)(id);
                // Instanciando o useCase no repositório com as funções
                const investmentRepository = new InvestmentRepository_1.InvestmentRepository();
                const getInvestmentByIDUseCase = new GetInvestmentByIDUseCase_1.GetInvestmentByIDUseCase(investmentRepository);
                const investment = yield getInvestmentByIDUseCase.execute(id);
                return res.status(200).json({
                    successMessage: "Investimento encontrado com sucesso!",
                    investment: investment
                });
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientValidationError) {
                    return res.status(401).json({
                        error: {
                            name: error.name,
                            message: error.message,
                        }
                    });
                }
                else {
                    return res.status(401).json({ error: { name: 'GetInvestmentByIDController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.GetInvestmentByIDController = GetInvestmentByIDController;
