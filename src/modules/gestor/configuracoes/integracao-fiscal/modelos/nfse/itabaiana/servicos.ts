import type { NfseFiscalData } from '../../../../../documentos/xml/shared/xmlFiscalTypes';

// Lista nacional: https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm
// Rótulos de itens explícitos; não classifica a atividade nem deduz pelo CNAE.
const descricoes: Record<string, string> = {
  '17.03': 'Planejamento, coordenação, programação ou organização técnica, financeira ou administrativa.',
  '17.19': 'Contabilidade, inclusive serviços técnicos e auxiliares.',
};
export function descricaoEnquadramento(nfse: NfseFiscalData) {
  const item = nfse.itemListaServico.replace(/^(\d{2})(\d{2})$/, '$1.$2');
  const description = nfse.descricaoServico || descricoes[item];
  const code = nfse.codigoServico || nfse.itemListaServico;
  return [code, description, item && code.replace('.', '') !== item.replace('.', '') ? `Item LC 116: ${item}.` : ''].filter(Boolean).join(' - ') || '-';
}
