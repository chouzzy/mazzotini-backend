import { mixed, number, object, string } from "yup";

const listResumedUsersSchema = object().shape({
    id: string(),
    name: string(),
    email: string().email('Digite um email válido'),
    role: mixed().oneOf(["INVESTOR", "PROJECT_MANAGER", "ADMINISTRATOR"])
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict()

export {listResumedUsersSchema}