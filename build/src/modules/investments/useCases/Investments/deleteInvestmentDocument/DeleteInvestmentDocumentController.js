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
exports.DeleteInvestmentDocumentController = void 0;
const InvestmentRepository_1 = require("../../../repositories/implementations/InvestmentRepository");
const client_1 = require("@prisma/client");
const DeleteInvestmentDocumentCheck_1 = require("./DeleteInvestmentDocumentCheck");
const DeleteInvestmentDocumentUseCase_1 = require("./DeleteInvestmentDocumentUseCase");
class DeleteInvestmentDocumentController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { investmentID, documentID } = req.body.data;
                if (typeof (documentID) != 'string' || typeof (investmentID) != 'string') {
                    throw Error("O id deve ser uma string");
                }
                yield (0, DeleteInvestmentDocumentCheck_1.checkParam)(documentID);
                yield (0, DeleteInvestmentDocumentCheck_1.checkParam)(investmentID);
                /// instanciação da classe do caso de uso
                const investmentRepository = new InvestmentRepository_1.InvestmentRepository();
                const deleteInvestmentUseCase = new DeleteInvestmentDocumentUseCase_1.DeleteInvestmentDocumentUseCase(investmentRepository);
                const documents = yield deleteInvestmentUseCase.execute(investmentID, documentID);
                return res.status(200).json({
                    successMessage: "Documento deletado com sucesso!",
                    documents: documents
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
                    return res.status(401).json({ error: { name: 'DeleteInvestmentDocumentController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.DeleteInvestmentDocumentController = DeleteInvestmentDocumentController;
