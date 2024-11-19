import * as yup from 'yup';

const createInvestorProfileSchema = yup.object({
  userId: yup.string().required("ID do usuário é obrigatório"),
  name: yup.string().required("O nome é obrigatório").min(2, "O nome precisa ter no mínimo dois caracteres"),
  age: yup.number().required("A idade é obrigatória").typeError('A idade deve ser um número').positive("A idade deve ser um número positivo"),
  profession: yup.string().required("A profissão é obrigatória"),
  monthlyIncome: yup.number().required("A renda mensal é obrigatória").typeError('A renda mensal deve ser um número').positive("A renda mensal deve ser um número positivo"),
  investmentGoals: yup.string().required("O objetivo do investimento é obrigatório."),
  riskTolerance: yup.string().required("A tolerância de risco é obrigatória"),

  investedBefore: yup.boolean().required("É obrigatório informar se já investiu antes"),
  investedBeforeType: yup.string().nullable(),
  investedBeforeTypeOther: yup.string().nullable(),
  investmentKnowledge: yup.string().nullable(),
  investmentHorizon: yup.string().required("O horizonte de investimento é obrigatório"),

  hasOtherInvestments: yup.boolean().required("É obrigatório informar se possui outros investimentos"),
  otherInvestments: yup.string().nullable(),

  preferredInvestmentTypes: yup.string().required("O tipo de investimento preferido é obrigatório"),
  preferredRentType: yup.string().required("O tipo de aluguel preferido é obrigatório"),
  finalConsiderations: yup.string().nullable(), // Considerando que pode ser vazio

}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();

export { createInvestorProfileSchema };