import type { jsPDF } from 'jspdf';
import type { NfseFiscalData } from '../../../../../documentos/xml/shared/xmlFiscalTypes';
import type { NfseModeloOptions } from './modelo';

// Padrões Interleaved 2 of 5: cada dígito tem duas posições largas (3 módulos).
const ITF_DIGITS = ['11331', '31113', '13113', '33111', '11313',
  '31311', '13311', '11133', '31131', '13131'];

/**
 * No PDF WebISS conferido, o ITF contém o código numérico da chave nacional,
 * com zero à esquerda para formar um número par de dígitos (10).
 * A chave é recebida do XML; nunca gerar identificador a partir do número da nota.
 * Composição oficial: município7 + gerador1 + inscrição1/14 + nota13 + AAMM4 + cNum9 + DV1.
 */
export function resolveBarcode(nfse: NfseFiscalData, options: NfseModeloOptions): string {
  if (options.demonstracao || options.ambiente === 'nao_identificado') return '';
  const key = nfse.chaveAcesso?.trim() || '';
  if (!/^2802908[12][12]\d{41}$/.test(key)) return '';
  const document = nfse.prestador.documento.replace(/\D/g, '');
  const kind = document.length === 14 ? '2' : document.length === 11 ? '1' : '';
  if (!kind || key[8] !== kind || key.slice(9, 23) !== document.padStart(14, '0')) return '';
  if (!/^\d{1,13}$/.test(nfse.numero) || key.slice(23, 36) !== nfse.numero.padStart(13, '0')) return '';
  const month = Number(key.slice(38, 40));
  if (month < 1 || month > 12) return '';
  return `0${key.slice(40, 49)}`;
}

/** Larguras alternadas de barras/espaços; sem dígito de controle adicional. */
export function encodeItf(value: string): number[] {
  if (!/^\d{2}(?:\d{2})*$/.test(value)) throw new Error('ITF requer uma quantidade par de dígitos.');
  const runs = [1, 1, 1, 1];
  for (let i = 0; i < value.length; i += 2) {
    const bars = ITF_DIGITS[Number(value[i])];
    const spaces = ITF_DIGITS[Number(value[i + 1])];
    for (let j = 0; j < 5; j += 1) runs.push(Number(bars[j]), Number(spaces[j]));
  }
  return [...runs, 3, 1, 1];
}

/** Barras vetoriais, com zonas silenciosas brancas de 10 módulos em cada lado. */
export function drawBarcode(pdf: jsPDF, value: string, x: number, y: number, width: number, height: number) {
  const runs = encodeItf(value);
  const unit = width / (runs.reduce((total, run) => total + run, 0) + 20);
  pdf.setFillColor('#ffffff').rect(x, y - 0.4, width, height + 0.8, 'F');
  pdf.setFillColor('#000000');
  let offset = 10;
  runs.forEach((run, index) => {
    if (index % 2 === 0) pdf.rect(x + offset * unit, y, run * unit, height, 'F');
    offset += run;
  });
}
