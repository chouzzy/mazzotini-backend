/**
 * Conta aprovada: status ACTIVE, ou nulo (cadastro antigo, de antes do onboarding). Só ela vê os
 * processos, os valores e os documentos do cliente. As outras estão no onboarding ou esperando a
 * aprovação, e a tela mostra só essas etapas.
 */
export const isApprovedAccount = (status: string | null | undefined): boolean => !status || status === 'ACTIVE';
