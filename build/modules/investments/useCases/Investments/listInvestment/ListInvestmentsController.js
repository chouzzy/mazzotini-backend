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
class ListInvestmentsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const listInvestmentData = req.query;
            const bodyValidation = yield (0, ListInvestmentsCheck_1.checkQuery)(listInvestmentData);
            if (bodyValidation.isValid === false) {
                return res.status(401).json({ errorMessage: bodyValidation.errorMessage });
            }
            // Instanciando o useCase no repositório com as funções
            const investmentRepository = new InvestmentRepository_1.InvestmentRepository();
            const listUsersUseCase = new ListInvestmentsUseCase_1.ListInvestmentUseCase(investmentRepository);
            const response = yield listUsersUseCase.execute(listInvestmentData);
            return res.status(response.statusCode).json(response);
        });
    }
}
exports.ListInvestmentsController = ListInvestmentsController;
