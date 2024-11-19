import { object, string } from "yup";

const findUserByEmailSchema = object().shape({
    email: string().email('Digite um email válido'),
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict()

export { findUserByEmailSchema }