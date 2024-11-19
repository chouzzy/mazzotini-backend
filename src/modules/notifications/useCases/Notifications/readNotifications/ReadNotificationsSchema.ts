import * as yup from "yup";

const readNotificationsSchema = yup.object({

    id: yup.string().required("O id do investimento é obrigatório."),

}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();

export { readNotificationsSchema };