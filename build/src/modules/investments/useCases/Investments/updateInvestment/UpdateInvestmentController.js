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
exports.UpdateInvestmentsController = void 0;
const InvestmentRepository_1 = require("../../../repositories/implementations/InvestmentRepository");
const UpdateInvestmentUseCase_1 = require("./UpdateInvestmentUseCase");
const UpdateInvestmentCheck_1 = require("./UpdateInvestmentCheck");
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
class UpdateInvestmentsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                // if (typeof(id) != 'string') {
                //     throw Error("O id deve ser uma string")
                // }
                const investmentData = req.body;
                const { partners, documents } = investmentData;
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
                yield (0, UpdateInvestmentCheck_1.checkBody)(investmentData);
                /// instanciação da classe do caso de uso
                const investmentRepository = new InvestmentRepository_1.InvestmentRepository();
                const updateInvestmentUseCase = new UpdateInvestmentUseCase_1.UpdateInvestmentUseCase(investmentRepository);
                const investment = yield updateInvestmentUseCase.execute(investmentData, id);
                return res.status(200).json({
                    successMessage: "Investimentos atualizados com sucesso!",
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
                    return res.status(401).json({ error: { name: 'UpdateInvestmentsController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.UpdateInvestmentsController = UpdateInvestmentsController;
