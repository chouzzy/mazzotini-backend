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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUsersSchema = void 0;
const yup = __importStar(require("yup"));
const yup_password_1 = __importDefault(require("yup-password"));
(0, yup_password_1.default)(yup); // Isso adiciona os métodos de validação de senha ao yup
const createUsersSchema = yup.object({
    name: yup.string().required("O nome é obrigatório").min(2, "O nome precisa ter no mínimo dois caracteres"),
    email: yup.string().email("Formato de email inválido").required("O e-mail é obrigatório").min(3, "O email precisa ter no mínimo três caracteres"),
    phoneNumber: yup.string(),
    gender: yup.string(),
    profession: yup.string(),
    birth: yup.string().typeError("A data de nascimento deve ser uma data válida no formato YYYY-MM-DD"),
    cpf: yup.string().min(11, "CPF inválido").max(11, "CPF inválido.").required("O CPF é obrigatório"),
    username: yup.string().required("O username é obrigatório").min(3, "O username precisa conter no mínimo 3 caracteres"),
    address: yup.object().shape({
        street: yup.string().required("A rua é obrigatória"),
        number: yup.string().required("O número é obrigatório"),
        complement: yup.string().optional(),
        district: yup.string().required("O bairro é obrigatório"),
        city: yup.string().required("A cidade é obrigatória"),
        state: yup.string().required("O estado é obrigatório"),
        zipCode: yup.string().required("O CEP é obrigatório"),
    }).nullable(),
    investorProfileName: yup.string().optional(),
    investorProfileDescription: yup.string().optional(),
    role: yup.mixed().oneOf(["INVESTOR", "PROJECT_MANAGER", "ADMINISTRATOR"]).required("A role é obrigatória")
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();
exports.createUsersSchema = createUsersSchema;
