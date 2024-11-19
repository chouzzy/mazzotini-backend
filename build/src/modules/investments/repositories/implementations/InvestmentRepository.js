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
exports.InvestmentRepository = void 0;
const investmentUtils_1 = require("../../../../utils/investmentUtils");
class InvestmentRepository {
    filterInvestmentByID(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filteredInvestment = yield (0, investmentUtils_1.filterPrismaInvestmentByID)(id);
                return filteredInvestment;
            }
            catch (error) {
                throw error;
            }
        });
    }
    filterInvestment(listInvestmentFormatted) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filteredInvestment = yield (0, investmentUtils_1.filterPrismaInvestment)(listInvestmentFormatted);
                return filteredInvestment;
            }
            catch (error) {
                throw error;
            }
        });
    }
    createInvestment(investmentData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const createdInvestment = yield (0, investmentUtils_1.createPrismaInvestment)(investmentData);
                return createdInvestment;
            }
            catch (error) {
                throw error;
            }
        });
    }
    updateInvestment(investmentData, id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedInvestment = yield (0, investmentUtils_1.updatePrismaInvestment)(investmentData, id);
                return updatedInvestment;
            }
            catch (error) {
                throw error;
            }
        });
    }
    deleteInvestment(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const deletedInvestment = yield (0, investmentUtils_1.deletePrismaInvestment)(id);
                return deletedInvestment;
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.InvestmentRepository = InvestmentRepository;
