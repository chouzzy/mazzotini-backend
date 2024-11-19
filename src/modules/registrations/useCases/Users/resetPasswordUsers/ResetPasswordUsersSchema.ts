import { mixed, number, object, string } from "yup";

const resetPasswordUsersSchema = object().shape({
    email: string().email('Digite um email válido').required("E-mail obrigatório"),
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict()

export {resetPasswordUsersSchema}