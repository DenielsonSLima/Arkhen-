import { HttpError } from './runtime.ts';

export const invitationSendError = (error: unknown): HttpError => {
  const failure = error && typeof error === 'object'
    ? error as { code?: string; status?: number }
    : undefined;
  if (failure?.code === 'over_email_send_rate_limit' || failure?.status === 429) {
    return new HttpError(429,
      'O serviço de e-mail atingiu o limite de envios. Este convite não foi enviado agora. Aguarde a liberação do limite antes de reenviar.');
  }
  return new HttpError(503, 'Não foi possível enviar o e-mail de convite. Tente novamente.');
};
