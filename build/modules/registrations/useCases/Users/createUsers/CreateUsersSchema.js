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
(0, yup_password_1.default)(yup);
const createUsersSchema = yup.object({
    name: yup.string().required("O nome é obrigatório").min(2, "O nome precisa ter no mínimo dois caracteres"),
    email: yup.string().required("O e-mail é obrigatório").min(3, "O email precisa ter no mínimo três caracteres"),
    cpf: yup.string().required("O CPF é obrigatório").min(11, "CPF inválido").max(11, "CPF inválido."),
    username: yup.string().required("O username é obrigatório").min(3, "O username precisa conter no mínimo 3 caracteres"),
    password: yup.string().required("Password é obrigatório").password().matches(/[a-zA-Z]/, 'Password can only contain Latin letters.')
    //   'password must be at least 8 characters',
    //   'password must contain at least 1 uppercase letter',
    //   'password must contain at least 1 number',
    //   'password must contain at least 1 symbol',
});
exports.createUsersSchema = createUsersSchema;
