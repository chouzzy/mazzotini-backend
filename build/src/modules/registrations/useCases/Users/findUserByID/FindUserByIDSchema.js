"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUserByIDSchema = void 0;
const yup_1 = require("yup");
const findUserByIDSchema = (0, yup_1.object)().shape({
    id: (0, yup_1.string)().required('Digite um ID válido'),
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();
exports.findUserByIDSchema = findUserByIDSchema;
