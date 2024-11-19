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
exports.ListInvestmentUseCase = void 0;
const investmentUtils_1 = require("../../../../../utils/investmentUtils");
class ListInvestmentUseCase {
    constructor(investmentRepository) {
        this.investmentRepository = investmentRepository;
    }
    execute(listInvestmentData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { title, buildingStatus, companyName, description, finishDateInitial, investmentDateInitial, finishDateFinal, investmentDateFinal, investmentValue } = listInvestmentData;
            const data = {
                title,
                buildingStatus,
                companyName,
                description,
                finishDateInitial,
                investmentDateInitial,
                finishDateFinal,
                investmentDateFinal,
                investmentValue
            };
            const { page, pageRange } = yield (0, investmentUtils_1.validatePageParams)(listInvestmentData);
            const listInvestmentFormatted = Object.assign(Object.assign({}, data), { page,
                pageRange });
            const users = yield this.investmentRepository.filterInvestment(listInvestmentFormatted);
            return users;
        });
    }
}
exports.ListInvestmentUseCase = ListInvestmentUseCase;
