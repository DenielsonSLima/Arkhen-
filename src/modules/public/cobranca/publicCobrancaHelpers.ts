import { supabase } from '../../../lib/supabase';

export interface PublicCobrancaPayload {
  id: string;
  publicToken?: string;
  descricao: string;
  servicoDescricao?: string;
  valor: number;
  dataVencimento: string;
  status: string;
  meioPagamento: string;
  paymentLink: string;
  bankSlipLink: string;
  pixCopyPaste?: string;
  clienteNome: string;
  clienteCnpj?: string;
  clienteEmail?: string;
  clienteTelefone?: string;
  clienteTipo?: string;
  clienteTipoEstabelecimento?: string;
  emissorNome?: string;
  emissorRazaoSocial?: string;
  emissorCnpj?: string;
  emissorLogoUrl?: string;
  isExpired?: boolean;
  expiredReason?: string;
  generatedAt: string;
}

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const parsePublicCobrancaPayload = (): PublicCobrancaPayload | null => {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(hash)) as PublicCobrancaPayload;
    if (!payload.id || !payload.clienteNome || !payload.paymentLink) return null;
    return payload;
  } catch {
    return null;
  }
};

export const getPublicCobrancaIdFromPath = () => {
  const segments = window.location.pathname.split('/').filter(Boolean);
  return segments[0] === 'cobranca' ? segments[1] || '' : '';
};

export const fetchPublicCobranca = async (publicToken: string): Promise<PublicCobrancaPayload | null> => {
  if (!publicToken) return null;
  const { data, error } = await supabase.rpc('get_public_cobranca', {
    p_public_token: publicToken,
  });

  if (error) throw error;
  return (data || null) as PublicCobrancaPayload | null;
};

export const formatPublicCobrancaCurrency = (value: number) => (
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
);

export const formatPublicCobrancaDate = (value: string) => {
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
};

export const formatPublicCobrancaDocument = (value?: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return value || '';
};

export const copyTextToClipboard = async (text: string) => {
  if (!text) throw new Error('Conteúdo vazio.');

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Usa fallback abaixo em ambientes locais sem HTTPS.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();

  if (!copied) throw new Error('Não foi possível copiar.');
};
