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
exports.createInvestmentSchema = void 0;
const yup = __importStar(require("yup"));
const createInvestmentSchema = yup.object({
    title: yup.string().required("O título do investimento é obrigatório."),
    description: yup.string().required("A descrição do investimento é obrigatória."),
    projectType: yup
        .mixed()
        .oneOf(["RESIDENCIAL_MULTIFAMILIAR", "RESIDENCIAL_VERTICAL", "COMERCIAL_GERAL", "MISTO"])
        .required("O tipo do projeto é obrigatório."),
    totalUnits: yup.number().integer().required("O total de unidades é obrigatório."),
    numberOfFloors: yup.number().integer().required("O número de pavimentos é obrigatório."),
    unitsPerFloor: yup.number().integer().required("O número de unidades por pavimento é obrigatório."),
    floorPlanTypes: yup.array().of(yup.string()).min(1, "Deve haver pelo menos uma tipologia de planta").required("As tipologias das plantas são obrigatórias."),
    launchDate: yup.string().required("A data de lançamento é obrigatória."),
    constructionStartDate: yup.string().required("A data de início da obra é obrigatória."),
    expectedDeliveryDate: yup.string().required("A data de previsão de entrega é obrigatória."),
    address: yup.object().shape({
        street: yup.string().required("A rua é obrigatória."),
        number: yup.string().required("O número é obrigatório."),
        complement: yup.string().optional(),
        district: yup.string().required("O bairro é obrigatório."),
        city: yup.string().required("A cidade é obrigatória."),
        state: yup.string().required("O estado é obrigatório."),
        zipCode: yup.string().required("O CEP é obrigatório."),
    }).required("O endereço do empreendimento é obrigatório"),
    partners: yup.array().of(yup.object().shape({
        id: yup.string().required("A ID é obrigatório."),
        url: yup.string().required("O link do parceiro é obrigatório"),
        name: yup.string().required('O nome do parceiro é obrigatório'),
        activity: yup.string().required("O segmento de atuação do parceiro é obrigatório"),
    })).nullable(),
    documents: yup
        .array()
        .of(yup.object().shape({
        title: yup.string(),
        url: yup.string().url()
    })),
    images: yup
        .array()
        .of(yup.object().shape({
        url: yup.string().url().required("A URL da imagem é obrigatória."),
        description: yup.string().optional(),
    }))
        .required("As imagens são obrigatórias."),
    investmentValue: yup.number().required("O valor do investimento é obrigatório."),
    companyName: yup.string().required("O nome da empresa é obrigatório."),
    finishDate: yup.string().nullable(),
    buildingStatus: yup.string().required("O status da construção é obrigatório."),
    investmentDate: yup.string().required("A data do investimento é obrigatória."),
    predictedCost: yup.object().shape({
        foundation: yup.string().required("O custo previsto da fundação é obrigatório."),
        structure: yup.string().required("O custo previsto da estrutura é obrigatório."),
        implantation: yup.string().required("O custo previsto da implantação é obrigatório."),
        workmanship: yup.string().required("O custo previsto da mão de obra é obrigatório."),
    }).required("O custo previsto é obrigatório"),
    realizedCost: yup.object().shape({
        foundation: yup.string().required("O custo realizado da fundação é obrigatório."),
        structure: yup.string().required("O custo realizado da estrutura é obrigatório."),
        implantation: yup.string().required("O custo realizado da implantação é obrigatório."),
        workmanship: yup.string().required("O custo realizado da mão de obra é obrigatório."),
    }).required("O custo realizado é obrigatório"),
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();
exports.createInvestmentSchema = createInvestmentSchema;
