interface ProtocolosErrorLike {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
  details?: unknown;
}

const asErrorLike = (error: unknown): ProtocolosErrorLike | null => (
  error !== null && typeof error === 'object' ? error as ProtocolosErrorLike : null
);

const codeOf = (error: ProtocolosErrorLike) => String(error.code || '').toUpperCase();
const statusOf = (error: ProtocolosErrorLike) => Number(error.status ?? error.statusCode);

export const mapProtocolosError = (error: unknown, action: 'carregar' | 'salvar'): Error => {
  const source = asErrorLike(error);
  if (!source) {
    return new Error(action === 'salvar'
      ? 'Não foi possível sincronizar as obrigações. Tente novamente.'
      : 'Não foi possível carregar as obrigações. Tente novamente.');
  }

  const code = codeOf(source);
  const status = statusOf(source);
  if (code === '22023' || status === 400) {
    return new Error('A configuração mudou ou possui valores inválidos. Atualize a tela e revise as obrigações.');
  }
  if (code === '42501' || status === 403) {
    return new Error('Você não tem permissão para acessar ou alterar as obrigações desta empresa.');
  }
  if (code === 'PGRST202' || code === '42883' || status === 404) {
    return new Error('A atualização necessária do sistema ainda não foi aplicada. Contate o administrador.');
  }

  return new Error(action === 'salvar'
    ? 'Não foi possível sincronizar as obrigações. Tente novamente.'
    : 'Não foi possível carregar as obrigações. Tente novamente.');
};
