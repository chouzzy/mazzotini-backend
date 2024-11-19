import { number, object, string } from "yup";

const listUsersSchema = object().shape({
    id: string(),
    name: string(),
    email: string().email('Digite um email válido'),

    cpf: string().matches(/^\d{11}$/, 'CPF deve ter 11 dígitos'),
    username: string(),
    password: string().min(8, 'A senha deve ter pelo menos 8 caracteres')
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict()

export {listUsersSchema}