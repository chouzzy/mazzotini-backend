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
exports.checkQuery = void 0;
const yup_1 = require("yup");
const ListUserInvestmentByInvestmentsIDSchema_1 = require("./ListUserInvestmentByInvestmentsIDSchema");
function checkQuery(listUserInvestmentData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield ListUserInvestmentByInvestmentsIDSchema_1.listUserInvestmentByInvestmentsIDSchema.validate(listUserInvestmentData, {
                abortEarly: false
            });
        }
        catch (error) {
            if (error instanceof yup_1.ValidationError) {
                return { errorMessage: error.errors, statusCode: 403, isValid: false };
            }
        }
        return { isValid: true, statusCode: 302 };
    });
}
exports.checkQuery = checkQuery;
