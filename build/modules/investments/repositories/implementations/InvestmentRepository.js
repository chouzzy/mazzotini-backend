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
const client_1 = require("@prisma/client");
const investmentUtils_1 = require("../../../../utils/investmentUtils");
class InvestmentRepository {
    filterInvestment(listInvestmentFormatted) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filteredInvestment = yield (0, investmentUtils_1.filterPrismaInvestment)(listInvestmentFormatted);
                return {
                    isValid: true,
                    statusCode: 202,
                    successMessage: 'Filtered investment.',
                    investmentList: filteredInvestment
                };
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                    return { isValid: false, errorMessage: error, statusCode: 403 };
                }
                else {
                    return { isValid: false, errorMessage: String(error), statusCode: 403 };
                }
            }
        });
    }
    createInvestment(investmentData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const createdInvestment = yield (0, investmentUtils_1.createPrismaInvestment)(investmentData);
                return {
                    isValid: true,
                    statusCode: 202,
                    successMessage: 'Create investment.',
                    investment: createdInvestment
                };
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
                    return { isValid: false, errorMessage: error, statusCode: 403 };
                }
                else {
                    return { isValid: false, errorMessage: String(error), statusCode: 403 };
                }
            }
        });
    }
}
exports.InvestmentRepository = InvestmentRepository;
