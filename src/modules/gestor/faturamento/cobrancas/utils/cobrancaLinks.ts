import type { CobrancaFinanceira } from '../../../financeiro/services/financeiroService';
import type { Company } from '../../../gestao-empresarial/services/gestaoEmpresarialService';

export interface PublicCobrancaPayload {
  id: string;
  publicToken?: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  status: CobrancaFinanceira['status'];
  meioPagamento: CobrancaFinanceira['meioPagamento'];
  paymentLink: string;
  bankSlipLink: string;
  pixCopyPaste?: string;
  clienteNome: string;
  clienteCnpj?: string;
  clienteEmail?: string;
  clienteTelefone?: string;
  clienteTipo?: string;
  clienteTipoEstabelecimento?: string;
  servicoDescricao?: string;
  emissorNome?: string;
  emissorRazaoSocial?: string;
  emissorCnpj?: string;
  emissorLogoUrl?: string;
  isExpired?: boolean;
  expiredReason?: string;
  generatedAt: string;
}

export const getCobrancaPaymentLink = (item: CobrancaFinanceira) => (
  item.asaasBankSlipUrl || item.asaasBoletoUrl || item.asaasInvoiceUrl || ''
);

export const getCobrancaBankSlipLink = (item: CobrancaFinanceira) => (
  item.asaasBankSlipUrl || item.asaasBoletoUrl || ''
);

export const getCobrancaAccessLabel = (item: CobrancaFinanceira) => {
  const hasBankSlip = Boolean(getCobrancaBankSlipLink(item));
  const hasPaymentLink = Boolean(getCobrancaPaymentLink(item));
  if (hasBankSlip && hasPaymentLink) return 'Boleto e link prontos para envio';
  if (hasBankSlip) return 'Boleto disponível para download';
  if (hasPaymentLink) return 'Link de pagamento pronto para envio';
  return 'Aguardando link de pagamento';
};

export const formatCobrancaCurrency = (value: number) => (
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
);

export const formatCobrancaDate = (value: string) => {
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
};

export const buildCobrancaShareMessage = (item: CobrancaFinanceira, cliente?: Company) => {
  const link = getPublicCobrancaLink(item, cliente);
  const clienteNome = cliente?.razaoSocial || cliente?.nome || 'cliente';
  return [
    `Olá, ${clienteNome}.`,
    '',
    'Segue sua cobrança:',
    `Descrição: ${item.descricao || 'Cobrança'}`,
    `Valor: ${formatCobrancaCurrency(item.valor)}`,
    `Vencimento: ${formatCobrancaDate(item.dataVencimento)}`,
    `Forma de pagamento: ${item.meioPagamento === 'Ambos' ? 'Boleto ou Pix' : item.meioPagamento}`,
    '',
    link ? `Acesse o pagamento por aqui:\n${link}` : 'O link de pagamento ainda não está disponível.',
  ].join('\n');
};

const readPayloadText = (payload: unknown, paths: string[][]) => {
  for (const path of paths) {
    let current: unknown = payload;
    for (const key of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[key];
    }
    if (typeof current === 'string' && current.trim()) return current.trim();
  }
  return '';
};

export const getCobrancaPixCopyPaste = (item: CobrancaFinanceira) => readPayloadText(item.asaasPayload, [
  ['pixQrCode', 'payload'],
  ['pixQrCode', 'copyPaste'],
  ['pixQrCode', 'copyPasteCode'],
  ['pixQrCode', 'encodedPayload'],
  ['pixQrCode', 'qrCode'],
  ['pix', 'payload'],
  ['payment', 'pixQrCode', 'payload'],
  ['payment', 'pixQrCode', 'copyPaste'],
]);

export const copyTextToClipboard = async (text: string) => {
  if (!text) throw new Error('Conteúdo vazio.');

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Continua para fallback manual, útil em IP local sem HTTPS.
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

const encodeBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

export const buildPublicCobrancaPayload = (
  item: CobrancaFinanceira,
  cliente?: Company,
): PublicCobrancaPayload => ({
  id: item.id,
  publicToken: item.publicToken,
  descricao: item.descricao || 'Cobrança',
  valor: item.valor,
  dataVencimento: item.dataVencimento,
  status: item.status,
  meioPagamento: item.meioPagamento,
  paymentLink: getCobrancaPaymentLink(item),
  bankSlipLink: getCobrancaBankSlipLink(item),
  pixCopyPaste: getCobrancaPixCopyPaste(item) || undefined,
  clienteNome: cliente?.razaoSocial || cliente?.nome || 'Cliente',
  clienteCnpj: cliente?.cnpj || undefined,
  clienteEmail: cliente?.email || undefined,
  clienteTelefone: cliente?.telefone || undefined,
  clienteTipo: cliente?.tipo || undefined,
  clienteTipoEstabelecimento: cliente?.tipoEstabelecimento || undefined,
  generatedAt: new Date().toISOString(),
});

export const encodePublicCobrancaPayload = (payload: PublicCobrancaPayload) => (
  encodeBase64Url(JSON.stringify(payload))
);

export const getPublicCobrancaLink = (item: CobrancaFinanceira, cliente?: Company) => {
  if (typeof window === 'undefined') return '';
  const payload = buildPublicCobrancaPayload(item, cliente);
  if (!payload.paymentLink || !item.publicToken) return '';
  return `${window.location.origin}/cobranca/${item.publicToken}`;
};

export const downloadCobrancaBankSlip = async (item: CobrancaFinanceira) => {
  const bankSlipLink = getCobrancaBankSlipLink(item);
  if (!bankSlipLink) throw new Error('Boleto não disponível.');

  const response = await fetch(bankSlipLink);
  if (!response.ok) throw new Error('Não foi possível baixar o boleto.');

  const blob = await response.blob();
  const fileName = `boleto-${item.asaasCobrancaId || item.id}.pdf`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};
