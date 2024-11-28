import * as yup from "yup";
import YupPassword from 'yup-password';
YupPassword(yup); // Isso adiciona os métodos de validação de senha ao yup

const deleteUserInvestmentsSchema = yup.object({
  id: yup.string().required("ID necessário.")
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict()

export { deleteUserInvestmentsSchema };