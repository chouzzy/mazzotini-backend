"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetInvestmentByIDSchema = void 0;
const yup_1 = require("yup");
const GetInvestmentByIDSchema = (0, yup_1.object)({
    id: (0, yup_1.string)().required("É necessário enviar o id")
});
exports.GetInvestmentByIDSchema = GetInvestmentByIDSchema;
