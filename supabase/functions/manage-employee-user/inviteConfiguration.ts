import { HttpError } from './runtime.ts';

// Endereco publico canonico do Arkhen. Nunca derive o destino de headers do caller.
const DEFAULT_APP_URL = 'https://arkhen.vercel.app';

export const inviteRedirectUrl = (
  configuredAppUrl = Deno.env.get('APP_URL'),
): string => {
  try {
    const url = new URL(configuredAppUrl?.trim() || DEFAULT_APP_URL);
    const localHttp = url.protocol === 'http:' && url.hostname === 'localhost';
    if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password) {
      throw new Error('Invalid application URL.');
    }
    return new URL('/redefinir-senha', url.origin).toString();
  } catch {
    throw new HttpError(503, 'O endereço de ativação do convite está configurado incorretamente.');
  }
};
