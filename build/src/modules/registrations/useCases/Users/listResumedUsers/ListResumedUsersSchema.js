"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listResumedUsersSchema = void 0;
const yup_1 = require("yup");
const listResumedUsersSchema = (0, yup_1.object)().shape({
    id: (0, yup_1.string)(),
    name: (0, yup_1.string)(),
    email: (0, yup_1.string)().email('Digite um email válido'),
    role: (0, yup_1.mixed)().oneOf(["INVESTOR", "PROJECT_MANAGER", "ADMINISTRATOR"])
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();
exports.listResumedUsersSchema = listResumedUsersSchema;
