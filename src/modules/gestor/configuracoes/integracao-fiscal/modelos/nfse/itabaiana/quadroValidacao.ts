import type { jsPDF } from 'jspdf';
import type { NfseFiscalData } from '../../../../../documentos/xml/shared/xmlFiscalTypes';
import type { NfseModeloOptions } from './modelo';
import { drawQrCode, resolveQrCode } from './qrCode';
import { drawBarcode, resolveBarcode } from './codigoBarras';

/** Ornamento vetorial próprio inspirado no quadro cinza da referência. */
function fundoCinza(pdf: jsPDF, x: number, y: number, height: number) {
  const width = 47;
  pdf.saveGraphicsState();
  pdf.setFillColor('#f4f4f4').setDrawColor('#888888').setLineWidth(0.25).rect(x, y, width, height, 'FD');
  pdf.setDrawColor('#bbbbbb').setLineWidth(0.12).rect(x + 0.7, y + 0.7, width - 1.4, height - 1.4);
  pdf.rect(x + 1.3, y + 1.3, width - 2.6, height - 2.6);
  // Malha de rosetas. Não contém códigos nem identificadores da nota de referência.
  pdf.setDrawColor('#b7b7b7').setLineWidth(0.075);
  for (let row = 0; row < Math.floor((height - 4) / 1.1); row += 1) {
    for (let col = 0; col < 32; col += 1) {
      const cx = x + 10.5 + col * 1.1, cy = y + 2 + row * 1.1;
      pdf.circle(cx, cy, 0.42, 'S');
      pdf.lines([[0.49, 0.49], [-0.49, 0.49], [-0.49, -0.49], [0.49, -0.49]], cx, cy - 0.49, [1, 1], 'S', true);
    }
  }
  // Faixa curva no canto superior direito, como na composição do modelo.
  pdf.setFillColor('#dedede');
  pdf.triangle(x + 14, y + 1.6, x + 45.4, y + 1.6, x + 45.4, y + 34, 'F');
  pdf.setDrawColor('#f8f8f8').setLineWidth(0.11);
  for (let i = 0; i < 36; i += 1) {
    const offset = i * 0.86;
    const startX = x + 14 + offset * 0.36;
    const startY = y + 1.7 + offset * 0.24;
    const endY = y + 1.7 + offset;
    pdf.lines([[7, 0.3, 16, offset * 0.48, x + 45.3 - startX, endY - startY]], startX, startY, [1, 1], 'S');
  }
  // Faixa lateral com linhas finas e identificação municipal vertical.
  pdf.setFillColor('#eeeeee').rect(x + 1.6, y + 1.6, 8.1, height - 3.2, 'F');
  pdf.setDrawColor('#a9a9a9').setLineWidth(0.1);
  for (let line = 0; line < 16; line += 1) pdf.line(x + 1.9 + line * 0.35, y + 1.8, x + 1.9 + line * 0.35, y + height - 1.8);
  pdf.setFillColor('#c5c5c5').rect(x + 4, y + 1.8, 2.3, height - 3.6, 'F');
  pdf.setDrawColor('#f8f8f8').setLineWidth(0.1);
  for (let line = 0; line < Math.floor((height - 4) / 0.4); line += 1) pdf.line(x + 4, y + 2 + line * 0.4, x + 6.3, y + 2 + line * 0.4);
  pdf.setFont('helvetica', 'bold').setFontSize(14).setTextColor('#999999');
  pdf.text('NFS-e', x + 4.1, y + 40, { angle: 90 });
  pdf.setFontSize(5.8).setTextColor('#111111');
  pdf.text('MUNICÍPIO DE ITABAIANA', x + 9.1, y + height - 2.2, { angle: 90 });
  pdf.restoreGraphicsState();
}

export function drawValidationPanel(pdf: jsPDF, nfse: NfseFiscalData, options: NfseModeloOptions, top: number) {
  const x = 159, y = top - 1, center = 187.5;
  const barcode = resolveBarcode(nfse, options);
  const height = barcode ? 69 : 60;
  fundoCinza(pdf, x, y, height);
  const splitNumber = /^\d{13}$/.test(nfse.numero);
  pdf.setTextColor('#000000').setFont('helvetica', 'bold').setFontSize(10);
  pdf.text(splitNumber ? `Nota: ${nfse.numero.slice(0, 6)}` : 'Número da NFS-e', center, y + 6, { align: 'center' });
  const number = splitNumber ? nfse.numero.slice(6) : nfse.numero;
  pdf.setFontSize(14);
  if (pdf.getTextWidth(number) > 33) pdf.setFontSize(14 * 33 / pdf.getTextWidth(number));
  pdf.text(number, center, y + 13, { align: 'center' });
  pdf.setFontSize(8.5).text('Código Verificação', center, y + 19, { align: 'center' });
  pdf.setFont('helvetica', 'normal').setFontSize(11);
  if (pdf.getTextWidth(nfse.codigoVerificacao) > 33) pdf.setFontSize(11 * 33 / pdf.getTextWidth(nfse.codigoVerificacao));
  pdf.text(nfse.codigoVerificacao, center, y + 24, { align: 'center' });
  const qr = resolveQrCode(nfse.qrPayload, options);
  if (qr.payload) drawQrCode(pdf, qr.payload, center - 13.5, y + 26, 27);
  if (barcode) drawBarcode(pdf, barcode, x + 11, y + 54.5, 34.5, 7);
  // Legenda funcional no rodapé branco; ornamentos não entram na margem do QR.
  pdf.setFillColor('#ffffff').rect(x + 11, y + height - 5.5, 34.5, 4, 'F');
  pdf.setFont('helvetica', 'normal').setFontSize(4.8).setTextColor('#111111');
  pdf.text(pdf.splitTextToSize(qr.caption, 33), center, y + height - 4, { align: 'center', lineHeightFactor: 1.1 });
  return height;
}
