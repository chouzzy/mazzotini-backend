import { object, string } from "yup";

const findUserByIDSchema = object().shape({
    id: string().required('Digite um ID válido'),
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict()

export { findUserByIDSchema }