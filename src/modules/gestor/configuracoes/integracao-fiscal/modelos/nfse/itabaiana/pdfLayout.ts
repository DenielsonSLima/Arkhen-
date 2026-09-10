import { jsPDF } from 'jspdf';
import type { NfseModeloOptions } from './modelo';
import { registrarFontes } from './fontes';
import { geometriaMarcaDagua } from './marcaDagua';

export type Cell = { label: string; value?: string; weight?: number; emphasis?: boolean; italic?: boolean };
export const statusLabels = (options: NfseModeloOptions) => [
  options.demonstracao ? 'MODELO DEMONSTRATIVO - SEM VALOR FISCAL'
    : options.ambiente === 'homologacao' ? 'HOMOLOGAÇÃO - SEM VALOR FISCAL'
    : options.ambiente === 'nao_identificado' ? 'AMBIENTE NÃO IDENTIFICADO - ESPELHO DO XML' : '',
  options.cancelada ? 'NFS-e CANCELADA' : '',
].filter(Boolean);

/** Medidas em mm. Hierarquia e divisórias próximas à referência WebISS. */
export function createPdfLayout(options: NfseModeloOptions, numero: string) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  registrarFontes(pdf, options.fontes);
  // Reserva espaço à faixa esquerda do papel timbrado cadastrado.
  const left = options.marcaDagua ? 12 : 4, width = 206 - left, bottom = 278;
  let y = 5;
  const status = statusLabels(options).join(' | ');
  const imageProperties = options.marcaDagua ? pdf.getImageProperties(options.marcaDagua.imagem) : undefined;
  const paintBackground = () => {
    if (options.marcaDagua && imageProperties) {
      const geometry = geometriaMarcaDagua(options.marcaDagua, imageProperties.width, imageProperties.height);
      pdf.saveGraphicsState();
      pdf.setGState(pdf.GState({ opacity: geometry.opacity }));
      pdf.addImage(options.marcaDagua.imagem, imageProperties.fileType, geometry.x, geometry.y,
        geometry.width, geometry.height, 'marca-empresa', 'FAST');
      pdf.restoreGraphicsState();
    }
    pdf.setTextColor('#000000').setFont('helvetica', 'normal');
    if (status) {
      pdf.setDrawColor('#777777').setLineWidth(0.2).rect(left, y - 2, width, 6);
      pdf.setFontSize(7.5).setFont('helvetica', 'bold').text(status, 105, y + 2, { align: 'center' });
      y += 8;
    }
  };
  paintBackground();
  const nextPage = () => {
    pdf.addPage(); y = 5; paintBackground();
    pdf.setFontSize(9).setFont('helvetica', 'bold').text(`NFS-e ${numero} | Continuação`, left, y + 3);
    y += 8;
  };
  const ensure = (height: number) => { if (y + height > bottom) nextPage(); };
  const section = (title: string, sectionWidth = width) => {
    ensure(15);
    pdf.setDrawColor('#8c8c8c').setLineWidth(0.4).line(left, y, left + sectionWidth, y);
    pdf.setFont('helvetica', 'normal').setTextColor('#000000').setFontSize(8).text(title.toUpperCase(), left, y + 3.4);
    y += 5;
  };
  const row = (cells: Cell[], rowWidth = width, align: 'left' | 'right' = 'left') => {
    const totalWeight = cells.reduce((sum, cell) => sum + (cell.weight || 1), 0);
    const widths = cells.map((cell) => rowWidth * (cell.weight || 1) / totalWeight);
    const values = cells.map((cell, i): string[] => {
      pdf.setFont('helvetica', cell.italic ? 'bolditalic' : 'bold').setFontSize(cell.emphasis ? 13 : 9.5);
      return pdf.splitTextToSize(cell.value || '-', widths[i] - 3);
    });
    pdf.setFont('helvetica', 'normal').setFontSize(6.5);
    const labels: string[][] = cells.map((cell, i) => pdf.splitTextToSize(cell.label, widths[i] - 3));
    const labelHeight = Math.max(...labels.map((lines) => lines.length)) * 2.5;
    const lineHeight = cells.some((cell) => cell.emphasis) ? 5 : 3.7;
    let offset = 0;
    const count = Math.max(...values.map((lines) => lines.length));
    while (offset < count) {
      ensure(labelHeight + lineHeight + 2);
      const fit = Math.max(1, Math.floor((bottom - y - labelHeight - 2) / lineHeight));
      const take = Math.min(count - offset, fit);
      let x = left;
      cells.forEach((cell, i) => {
        const anchor = align === 'right' ? x + widths[i] - (i === cells.length - 1 ? 0 : 3) : x;
        pdf.setFontSize(6.5).setFont('helvetica', cell.emphasis ? 'bold' : 'normal');
        pdf.text(labels[i], anchor, y + 2, { align, lineHeightFactor: 1.09 });
        pdf.setFontSize(cell.emphasis ? 13 : 9.5).setFont('helvetica', cell.italic ? 'bolditalic' : 'bold');
        const lines = values[i].slice(offset, offset + take);
        if (lines.length) pdf.text(lines, anchor, y + labelHeight + 3.4, { align, lineHeightFactor: 1.1 });
        x += widths[i];
      });
      y += labelHeight + take * lineHeight + 2;
      offset += take;
      if (offset < count) nextPage();
    }
  };
  const paragraph = (value: string, minHeight = 0, style: 'normal' | 'bold' = 'normal', size = 8) => {
    pdf.setFont('helvetica', style).setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(value || '-', width);
    let offset = 0, used = 0;
    const lineHeight = size * 0.352778 * 1.18;
    while (offset < lines.length) {
      ensure(lineHeight + 2);
      const take = Math.min(lines.length - offset, Math.max(1, Math.floor((bottom - y - 2) / lineHeight)));
      pdf.setFont('helvetica', style).setFontSize(size).setTextColor('#000000');
      pdf.text(lines.slice(offset, offset + take), left, y + 2.5, { lineHeightFactor: 1.18 });
      y += take * lineHeight; used += take * lineHeight; offset += take;
      if (offset < lines.length) nextPage();
    }
    const padding = Math.max(2, minHeight - used);
    y += Math.min(padding, Math.max(0, bottom - y));
  };
  const finish = (validation: string) => {
    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      pdf.setPage(page).setDrawColor('#8c8c8c').setLineWidth(0.4).line(left, 281, left + width, 281);
      pdf.setFont('helvetica', 'normal').setFontSize(6.3).setTextColor('#333333');
      pdf.text('Representação auxiliar da NFS-e a partir do XML do WebISS. Valores conforme documento de origem.', left, 284);
      if (validation) pdf.textWithLink('Validar autenticidade: ' + validation, left, 287, { url: validation });
      pdf.text(`${page}/${pages}`, left + width, 287, { align: 'right' });
      if (status) pdf.text(status, left, 290);
      if (options.brasaoImagem) pdf.setFontSize(5).textWithLink('Brasão vetorial: BrCaLeTo / CC BY-SA 4.0', left, 294, {
        url: 'https://commons.wikimedia.org/wiki/File:Bras%C3%A3o_de_Itabaiana_-_SE.svg',
      });
    }
    return pdf;
  };
  return { pdf, left, width, section, row, paragraph, ensure, finish, getY: () => y, setY: (value: number) => { y = value; } };
}
