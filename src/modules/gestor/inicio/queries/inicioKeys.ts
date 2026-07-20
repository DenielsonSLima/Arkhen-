export const inicioKeys = {
  all: ['inicio'] as const,
  dashboard: () => [...inicioKeys.all, 'dashboard'] as const,
  vencimentos: () => [...inicioKeys.all, 'vencimentos'] as const,
  companyNotice: () => [...inicioKeys.all, 'company-notice'] as const,
  mensagemInspiradora: (data: string) => [...inicioKeys.all, 'mensagem-inspiradora', data] as const,
};
