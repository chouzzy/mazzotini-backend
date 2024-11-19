"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorSchema = void 0;
const yup_1 = require("yup");
const errorSchema = (0, yup_1.object)({
    isValid: (0, yup_1.boolean)().required(),
    errorMessage: (0, yup_1.string)(),
    successMessage: (0, yup_1.string)(),
    statusCode: (0, yup_1.number)().required(),
});
exports.errorSchema = errorSchema;
