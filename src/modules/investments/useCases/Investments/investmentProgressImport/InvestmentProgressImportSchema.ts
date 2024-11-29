import * as yup from "yup";

const importInvestmentProgressSchema = yup.object({

  worksheet: yup.object().required("A planilha é obrigatória"),
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();

export { importInvestmentProgressSchema };