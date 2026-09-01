export type ProtocolosErrorCode =
  | 'evidence_required'
  | 'forbidden'
  | 'invalid_data'
  | 'conflict'
  | 'not_found'
  | 'service_unavailable'
  | 'unexpected';

export class ProtocolosError extends Error {
  readonly code: ProtocolosErrorCode;

  constructor(code: ProtocolosErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ProtocolosError';
    this.code = code;
  }
}

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

const readError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return { code: '', text: String(error || '') };
  }

  const value = error as ErrorLike;
  return {
    code: typeof value.code === 'string' ? value.code : '',
    text: [value.message, value.details, value.hint]
      .filter((item): item is string => typeof item === 'string')
      .join(' ')
      .toLocaleLowerCase('pt-BR'),
  };
};

export const evidenceRequiredError = () => new ProtocolosError(
  'evidence_required',
  'Informe uma evidência com pelo menos 8 caracteres para concluir ou reabrir o item.',
);

export const mapProtocolosError = (
  error: unknown,
  fallback = 'Não foi possível concluir a operação de acompanhamento. Tente novamente.',
): ProtocolosError => {
  if (error instanceof ProtocolosError) return error;

  const { code, text } = readError(error);

  if (code === '40001') {
    return new ProtocolosError(
      'conflict',
      'Esta configuração foi alterada em outra tela. Recarregue os dados antes de salvar novamente.',
      error,
    );
  }

  if (code === '22023' && (text.includes('evidência') || text.includes('evidencia'))) {
    return evidenceRequiredError();
  }

  if (text.includes('já está neste status') || text.includes('ja esta neste status')) {
    return new ProtocolosError(
      'conflict',
      'O item já está nesse status. Atualize a lista e tente novamente.',
      error,
    );
  }

  if (
    code === '42501'
    || text.includes('permission denied')
    || text.includes('somente gestores')
    || text.includes('acesso não autorizado')
    || text.includes('acesso nao autorizado')
  ) {
    return new ProtocolosError(
      'forbidden',
      'Você não tem permissão para realizar esta operação no acompanhamento.',
      error,
    );
  }

  if (code === 'PGRST202' || code === '42883' || text.includes('function') && text.includes('not found')) {
    return new ProtocolosError(
      'service_unavailable',
      'O serviço seguro de acompanhamento não está disponível neste ambiente.',
      error,
    );
  }

  if (code === '22023') {
    return new ProtocolosError('invalid_data', 'Os dados do acompanhamento são inválidos.', error);
  }

  if (text.includes('protocolo não encontrado') || text.includes('protocolo nao encontrado')) {
    return new ProtocolosError(
      'not_found',
      'O item de acompanhamento não foi encontrado ou não está disponível para este usuário.',
      error,
    );
  }

  return new ProtocolosError('unexpected', fallback, error);
};

export const getProtocolosErrorMessage = (error: unknown) => (
  error instanceof ProtocolosError
    ? error.message
    : mapProtocolosError(error).message
);
