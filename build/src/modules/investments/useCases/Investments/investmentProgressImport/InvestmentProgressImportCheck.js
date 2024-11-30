"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkWorksheet = void 0;
const yup_1 = require("yup");
function checkWorksheet(worksheet) {
    return __awaiter(this, void 0, void 0, function* () {
        // check body properties
        try {
            // 1. Validar o número de colunas
            if (worksheet.columnCount !== 5) {
                throw new yup_1.ValidationError('Número de colunas inválido.');
            }
            // 2. Validar os tipos de dados
            for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
                const row = worksheet.getRow(rowNumber);
                if (isNaN(row.getCell(2).value) || isNaN(row.getCell(4).value)) { // Verifica se as colunas 2 e 3 são numéricas
                    throw new yup_1.ValidationError(`Valores inválidos na linha ${rowNumber}.`);
                }
                if ((row.getCell(3).value == null) || (row.getCell(5).value == null)) {
                    row.getCell(3).value = 0; // Preenche com 0 antes de lançar o erro
                    row.getCell(5).value = 0; // Preenche com 0 antes de lançar o erro
                }
                if (isNaN(row.getCell(3).value) || isNaN(row.getCell(5).value)) {
                    throw new yup_1.ValidationError(`Valores inválidos na linha ${rowNumber}.`);
                }
            }
            return;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.checkWorksheet = checkWorksheet;
