import { ValidationError } from "yup";
import { Worksheet } from "exceljs";




async function checkWorksheet(worksheet: Worksheet) {
  // check body properties
  try {
    // 1. Validar o número de colunas
    if (worksheet.columnCount !== 5) {
      throw new ValidationError('Número de colunas inválido.');
    }

    // 2. Validar os tipos de dados
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {

      const row = worksheet.getRow(rowNumber);

      if (isNaN(row.getCell(2).value as number) || isNaN(row.getCell(4).value as number)) { // Verifica se as colunas 2 e 3 são numéricas
        throw new ValidationError(`Valores inválidos na linha ${rowNumber}.`);
      }

      if ((row.getCell(3).value == null) || (row.getCell(5).value == null)) {
        row.getCell(3).value = 0; // Preenche com 0 antes de lançar o erro
        row.getCell(5).value = 0; // Preenche com 0 antes de lançar o erro
      }

      if (isNaN(row.getCell(3).value as number) || isNaN(row.getCell(5).value as number)) {
        throw new ValidationError(`Valores inválidos na linha ${rowNumber}.`);
      }

    }
    return
  }
  catch (error) {
    throw error
  }
}
export { checkWorksheet }



