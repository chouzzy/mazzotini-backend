"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInvestmentSchema = void 0;
const yup_1 = require("yup");
const listInvestmentSchema = (0, yup_1.object)({
    title: (0, yup_1.string)(),
    description: (0, yup_1.string)(),
    investmentValue: (0, yup_1.number)(),
    companyName: (0, yup_1.string)(),
    finishDateInitial: (0, yup_1.date)(),
    finishDateFinal: (0, yup_1.date)(),
    buildingStatus: (0, yup_1.string)(),
    investmentDateInitial: (0, yup_1.date)(),
    investmentDateFinal: (0, yup_1.date)()
});
exports.listInvestmentSchema = listInvestmentSchema;
