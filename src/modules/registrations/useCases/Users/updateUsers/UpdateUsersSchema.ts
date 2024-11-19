import * as yup from "yup";
import YupPassword from 'yup-password';
YupPassword(yup); // Isso adiciona os métodos de validação de senha ao yup

const updateUsersSchema = yup.object({
  name: yup.string(),
  email: yup.string().email("Formato de email inválido"),
  phoneNumber: yup.string(),
  gender: yup.string(),
  profession: yup.string(),

  birth: yup.date(),

  username: yup.string(),

  address: yup.object().shape({
    street: yup.string(),
    number: yup.string(),
    complement: yup.string().optional(),
    district: yup.string(),
    city: yup.string(),
    state: yup.string(),
    zipCode: yup.string(),
  }).nullable(), // Permite que o endereço seja nulo

  investorProfileName: yup.string().optional(),
  investorProfileDescription: yup.string().optional(),
  
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict()

export { updateUsersSchema };