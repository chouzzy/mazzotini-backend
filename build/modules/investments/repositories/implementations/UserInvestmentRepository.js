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
exports.UserInvestmentRepository = void 0;
const userInvestmentUtils_1 = require("../../../../utils/userInvestmentUtils");
class UserInvestmentRepository {
    constructor() {
        this.userInvestment = [];
    }
    filterUserInvestment(listUserInvestmentData) {
        return __awaiter(this, void 0, void 0, function* () {
            const filteredUserInvestment = yield (0, userInvestmentUtils_1.filterPrismaUserInvestment)(listUserInvestmentData);
            return {
                isValid: true,
                statusCode: 202,
                successMessage: 'Filtered investment.',
                userInvestmentList: filteredUserInvestment
            };
        });
    }
    createUserInvestment(userInvestmentData) {
        return __awaiter(this, void 0, void 0, function* () {
            const userInvestment = yield (0, userInvestmentUtils_1.createPrismaUserInvestment)(userInvestmentData);
            return {
                isValid: true,
                statusCode: 202,
                successMessage: 'Created investment.',
                userInvestment: userInvestment
            };
        });
    }
}
exports.UserInvestmentRepository = UserInvestmentRepository;
