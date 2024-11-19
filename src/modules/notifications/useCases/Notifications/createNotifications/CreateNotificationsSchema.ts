import * as yup from "yup";

const createNotificationsSchema = yup.object({

    title: yup.string().required("O título do investimento é obrigatório."),
    investmentId: yup.string().required("O título do investimento é obrigatório."),
    message: yup.string().required("A mensagem da notificação é obrigatória.").min(5,"A mensagem deve conter ao menos 5 caracteres"),

}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();

export { createNotificationsSchema };