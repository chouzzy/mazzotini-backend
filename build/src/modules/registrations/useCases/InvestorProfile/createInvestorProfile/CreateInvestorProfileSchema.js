"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvestorProfileSchema = void 0;
const yup = __importStar(require("yup"));
const createInvestorProfileSchema = yup.object({
    userId: yup.string().required("ID do usuário é obrigatório"),
    name: yup.string().required("O nome é obrigatório").min(2, "O nome precisa ter no mínimo dois caracteres"),
    age: yup.number().required("A idade é obrigatória").typeError('A idade deve ser um número').positive("A idade deve ser um número positivo"),
    profession: yup.string().required("A profissão é obrigatória"),
    monthlyIncome: yup.number().required("A renda mensal é obrigatória").typeError('A renda mensal deve ser um número').positive("A renda mensal deve ser um número positivo"),
    investmentGoals: yup.string().required("O objetivo do investimento é obrigatório."),
    riskTolerance: yup.string().required("A tolerância de risco é obrigatória"),
    investedBefore: yup.boolean().required("É obrigatório informar se já investiu antes"),
    investedBeforeType: yup.string().nullable(),
    investedBeforeTypeOther: yup.string().nullable(),
    investmentKnowledge: yup.string().nullable(),
    investmentHorizon: yup.string().required("O horizonte de investimento é obrigatório"),
    hasOtherInvestments: yup.boolean().required("É obrigatório informar se possui outros investimentos"),
    otherInvestments: yup.string().nullable(),
    preferredInvestmentTypes: yup.string().required("O tipo de investimento preferido é obrigatório"),
    preferredRentType: yup.string().required("O tipo de aluguel preferido é obrigatório"),
    finalConsiderations: yup.string().nullable(), // Considerando que pode ser vazio
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();
exports.createInvestorProfileSchema = createInvestorProfileSchema;
