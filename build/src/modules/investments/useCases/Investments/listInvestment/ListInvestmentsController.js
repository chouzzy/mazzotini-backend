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
exports.ListInvestmentsController = void 0;
const ListInvestmentsCheck_1 = require("./ListInvestmentsCheck");
const InvestmentRepository_1 = require("../../../repositories/implementations/InvestmentRepository");
const ListInvestmentsUseCase_1 = require("./ListInvestmentsUseCase");
const client_1 = require("@prisma/client");
class ListInvestmentsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const listInvestmentData = req.query;
                console.log(listInvestmentData);
                if (listInvestmentData.active === 'true') {
                    listInvestmentData.active = true;
                }
                if (listInvestmentData.active === 'false') {
                    listInvestmentData.active = false;
                }
                yield (0, ListInvestmentsCheck_1.checkQuery)(listInvestmentData);
                // Instanciando o useCase no repositório com as funções
                const investmentRepository = new InvestmentRepository_1.InvestmentRepository();
                const listUsersUseCase = new ListInvestmentsUseCase_1.ListInvestmentUseCase(investmentRepository);
                const investments = yield listUsersUseCase.execute(listInvestmentData);
                return res.status(200).json({
                    successMessage: "Investimentos listados com sucesso!",
                    investments: investments
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
                    return res.status(401).json({ error: { name: 'ListInvestmentsController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.ListInvestmentsController = ListInvestmentsController;
