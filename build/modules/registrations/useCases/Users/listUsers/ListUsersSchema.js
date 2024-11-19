"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsersSchema = void 0;
const yup_1 = require("yup");
const listUsersSchema = (0, yup_1.object)().shape({
    id: (0, yup_1.string)(),
    name: (0, yup_1.string)(),
    email: (0, yup_1.string)().email('Digite um email válido'),
    cpf: (0, yup_1.string)().matches(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
    username: (0, yup_1.string)(),
    password: (0, yup_1.string)().min(8, 'A senha deve ter pelo menos 8 caracteres')
});
exports.listUsersSchema = listUsersSchema;
