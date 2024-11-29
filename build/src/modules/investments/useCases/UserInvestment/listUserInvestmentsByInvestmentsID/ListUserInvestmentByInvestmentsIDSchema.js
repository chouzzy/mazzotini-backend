"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUserInvestmentByInvestmentsIDSchema = void 0;
const yup_1 = require("yup");
const listUserInvestmentByInvestmentsIDSchema = (0, yup_1.object)({
    investmentID: (0, yup_1.string)(),
    page: (0, yup_1.string)(),
    pageRange: (0, yup_1.string)()
});
exports.listUserInvestmentByInvestmentsIDSchema = listUserInvestmentByInvestmentsIDSchema;
