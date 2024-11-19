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
class CreateInvestmentsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const investmentData = req.body;
            const bodyValidation = yield (0, CreateInvestmentCheck_1.checkBody)(investmentData);
            if (bodyValidation.isValid === false) {
                return res.status(401).json({ errorMessage: bodyValidation.errorMessage });
            }
            /// instanciação da classe do caso de uso
            const investmentRepository = new InvestmentRepository_1.InvestmentRepository();
            const createUsersUseCase = new CreateInvestmentUseCase_1.CreateInvestmentUseCase(investmentRepository);
            const response = yield createUsersUseCase.execute(investmentData);
            return res.status(response.statusCode).json(response);
        });
    }
}
exports.CreateInvestmentsController = CreateInvestmentsController;
