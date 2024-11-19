"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordUsersSchema = void 0;
const yup_1 = require("yup");
const resetPasswordUsersSchema = (0, yup_1.object)().shape({
    email: (0, yup_1.string)().email('Digite um email válido').required("E-mail obrigatório"),
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();
exports.resetPasswordUsersSchema = resetPasswordUsersSchema;
