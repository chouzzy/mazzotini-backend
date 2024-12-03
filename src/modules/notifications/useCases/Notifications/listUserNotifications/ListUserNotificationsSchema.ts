import * as yup from "yup";

const listUserNotificationsSchema = yup.object({

    userID: yup.string().required("O id do usuário é obrigatório."),
    page: yup.string().required("O página inicial é obrigatória."),
    pageRange: yup.string().required("O range das páginas é obrigatório."),

}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();

export { listUserNotificationsSchema };