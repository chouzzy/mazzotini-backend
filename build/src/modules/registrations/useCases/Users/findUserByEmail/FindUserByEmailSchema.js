"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUserByEmailSchema = void 0;
const yup_1 = require("yup");
const findUserByEmailSchema = (0, yup_1.object)().shape({
    email: (0, yup_1.string)().email('Digite um email válido'),
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();
exports.findUserByEmailSchema = findUserByEmailSchema;
