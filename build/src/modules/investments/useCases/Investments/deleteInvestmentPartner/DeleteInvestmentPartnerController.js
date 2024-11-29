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
exports.DeleteInvestmentPartnerController = void 0;
const InvestmentRepository_1 = require("../../../repositories/implementations/InvestmentRepository");
const client_1 = require("@prisma/client");
const DeleteInvestmentPartnerCheck_1 = require("./DeleteInvestmentPartnerCheck");
const DeleteInvestmentPartnerUseCase_1 = require("./DeleteInvestmentPartnerUseCase");
class DeleteInvestmentPartnerController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { investmentID, partnerID } = req.body.data;
                if (typeof (partnerID) != 'string' || typeof (investmentID) != 'string') {
                    throw Error("O id deve ser uma string");
                }
                yield (0, DeleteInvestmentPartnerCheck_1.checkParam)(partnerID);
                yield (0, DeleteInvestmentPartnerCheck_1.checkParam)(investmentID);
                /// instanciação da classe do caso de uso
                const investmentRepository = new InvestmentRepository_1.InvestmentRepository();
                const deleteInvestmentUseCase = new DeleteInvestmentPartnerUseCase_1.DeleteInvestmentPartnerUseCase(investmentRepository);
                const investment = yield deleteInvestmentUseCase.execute(investmentID, partnerID);
                return res.status(200).json({
                    successMessage: "Partner deletado com sucesso!",
                    partners: investment
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
                    return res.status(401).json({ error: { name: 'DeleteInvestmentPartnerController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.DeleteInvestmentPartnerController = DeleteInvestmentPartnerController;
