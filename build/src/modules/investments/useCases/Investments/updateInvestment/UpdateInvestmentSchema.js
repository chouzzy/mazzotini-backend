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
exports.updateInvestmentSchema = void 0;
const yup = __importStar(require("yup"));
const updateInvestmentSchema = yup.object({
    title: yup.string(),
    description: yup.string(),
    projectType: yup
        .mixed()
        .oneOf([
        "RESIDENCIAL_MULTIFAMILIAR",
        "RESIDENCIAL_VERTICAL",
        "COMERCIAL_GERAL",
        "MISTO",
    ]),
    totalUnits: yup.number().integer().positive(),
    numberOfFloors: yup.number().integer().positive(),
    unitsPerFloor: yup.number().integer().positive(),
    floorPlanTypes: yup.array().of(yup.string()).min(1),
    launchDate: yup.date(),
    constructionStartDate: yup.date(),
    expectedDeliveryDate: yup.date(),
    address: yup.object().shape({
        street: yup.string(),
        number: yup.string(),
        complement: yup.string(),
        district: yup.string(),
        city: yup.string(),
        state: yup.string(),
        zipCode: yup.string(),
    }),
    documents: yup
        .array()
        .of(yup.object().shape({
        title: yup.string(),
        url: yup.string().url(),
    })),
    images: yup
        .array()
        .of(yup.object().shape({
        url: yup.string().url(),
        description: yup.string(), // Removido o optional()
    })),
    investmentValue: yup.number().positive(),
    companyName: yup.string(),
    partners: yup.array().of(yup.object().shape({
        id: yup.string().required("A ID é obrigatório."),
        url: yup.string().required("O link do parceiro é obrigatório"),
        name: yup.string().required('O nome do parceiro é obrigatório'),
        activity: yup.string().required("O segmento de atuação do parceiro é obrigatório"),
    })).nullable(),
    finishDate: yup.date().nullable(),
    buildingStatus: yup.string(),
    investmentDate: yup.date(),
    predictedCost: yup.object().shape({
        foundation: yup.string(),
        structure: yup.string(),
        implantation: yup.string(),
        workmanship: yup.string(),
    }),
    realizedCost: yup.object().shape({
        foundation: yup.string(),
        structure: yup.string(),
        implantation: yup.string(),
        workmanship: yup.string(),
    }),
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();
exports.updateInvestmentSchema = updateInvestmentSchema;
