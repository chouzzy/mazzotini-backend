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
exports.DeleteInvestmentImageController = void 0;
const InvestmentRepository_1 = require("../../../repositories/implementations/InvestmentRepository");
const client_1 = require("@prisma/client");
const DeleteInvestmentImageCheck_1 = require("./DeleteInvestmentImageCheck");
const DeleteInvestmentImageUseCase_1 = require("./DeleteInvestmentImageUseCase");
class DeleteInvestmentImageController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { investmentID, imageID } = req.body.data;
                console.log('investmentID, imageID');
                console.log(investmentID, imageID);
                if (typeof (imageID) != 'string' || typeof (investmentID) != 'string') {
                    throw Error("O id deve ser uma string");
                }
                yield (0, DeleteInvestmentImageCheck_1.checkParam)(imageID);
                yield (0, DeleteInvestmentImageCheck_1.checkParam)(investmentID);
                /// instanciação da classe do caso de uso
                const investmentRepository = new InvestmentRepository_1.InvestmentRepository();
                const deleteInvestmentUseCase = new DeleteInvestmentImageUseCase_1.DeleteInvestmentImageUseCase(investmentRepository);
                const investment = yield deleteInvestmentUseCase.execute(investmentID, imageID);
                return res.status(200).json({
                    successMessage: "Foto deletada com sucesso!",
                    images: investment
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
                    return res.status(401).json({ error: { name: 'DeleteInvestmentImageController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.DeleteInvestmentImageController = DeleteInvestmentImageController;
