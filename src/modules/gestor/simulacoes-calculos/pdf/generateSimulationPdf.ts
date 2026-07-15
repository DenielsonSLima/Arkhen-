import type { jsPDF as JsPdfDocument } from 'jspdf';
import type {
  GeneratedSimulationPdf,
  SimulationPdfInput,
  SimulationPdfRow,
} from './simulationPdfTypes';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 16;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_X * 2);
const CONTENT_BOTTOM = 274;
const GOLD = '#c59235';
const NAVY = '#0f172a';
const SLATE = '#64748b';
const LIGHT_LINE = '#dbe3ec';

const formatGeneratedAt = (date: Date) => date.toLocaleString('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatCnpj = (value = '') => {
  const clean = value.replace(/\D/g, '');
  return clean.length === 14
    ? clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : value || 'Não informado';
};

const imageFormat = (dataUrl: string) => {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
};

const safeAddImage = (
  doc: JsPdfDocument,
  dataUrl: string | null | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  if (!dataUrl) return false;
  try {
    doc.addImage(dataUrl, imageFormat(dataUrl), x, y, width, height, undefined, 'FAST');
    return true;
  } catch (error) {
    console.warn('Imagem ignorada durante a geração do PDF.', error);
    return false;
  }
};

const drawWatermark = (doc: JsPdfDocument, input: SimulationPdfInput) => {
  const watermark = input.watermark;
  if (!watermark?.enabled || !watermark.dataUrl) return;

  const sizePercent = Math.max(12, Math.min(70, watermark.size ?? 35));
  const width = CONTENT_WIDTH * (sizePercent / 100);
  const height = width;
  const position = watermark.position ?? 'centro';
  let x = (PAGE_WIDTH - width) / 2;
  let y = (PAGE_HEIGHT - height) / 2;

  if (position === 'topo-esquerda') {
    x = MARGIN_X;
    y = 22;
  } else if (position === 'topo-direita') {
    x = PAGE_WIDTH - MARGIN_X - width;
    y = 22;
  } else if (position === 'rodape-direita') {
    x = PAGE_WIDTH - MARGIN_X - width;
    y = PAGE_HEIGHT - 24 - height;
  }

  try {
    const opacity = Math.max(0.03, Math.min(0.25, (watermark.opacity ?? 10) / 100));
    const pdfWithState = doc as JsPdfDocument & {
      GState: new (options: { opacity: number }) => unknown;
      setGState: (state: unknown) => void;
    };
    pdfWithState.setGState(new pdfWithState.GState({ opacity }));
    safeAddImage(doc, watermark.dataUrl, x, y, width, height);
    pdfWithState.setGState(new pdfWithState.GState({ opacity: 1 }));
  } catch {
    // A marca d'água é opcional; texto e paginação nunca dependem dela.
  }
};

const drawFooter = (doc: JsPdfDocument, input: SimulationPdfInput, pageNumber: number, totalPages: number) => {
  doc.setDrawColor(LIGHT_LINE);
  doc.setLineWidth(0.25);
  doc.line(MARGIN_X, 281, PAGE_WIDTH - MARGIN_X, 281);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(SLATE);
  doc.text(`Gerado eletronicamente por Arkhen Gestão Contábil em ${formatGeneratedAt(input.generatedAt)}`, MARGIN_X, 286);
  doc.setFont('helvetica', 'bold');
  doc.text(`Página ${pageNumber} de ${totalPages}`, PAGE_WIDTH - MARGIN_X, 286, { align: 'right' });
};

const drawPageHeader = (doc: JsPdfDocument, input: SimulationPdfInput, firstPage: boolean) => {
  drawWatermark(doc, input);
  const companyName = input.company.razaoSocial || input.company.nomeFantasia || 'Arkhen Gestão Contábil';

  if (!firstPage) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(NAVY);
    doc.text(companyName.toUpperCase(), MARGIN_X, 15);
    doc.setFontSize(8);
    doc.setTextColor(GOLD);
    doc.text(input.title.toUpperCase(), PAGE_WIDTH - MARGIN_X, 15, { align: 'right' });
    doc.setDrawColor(GOLD);
    doc.setLineWidth(0.4);
    doc.line(MARGIN_X, 20, PAGE_WIDTH - MARGIN_X, 20);
    return 29;
  }

  const hasLogo = safeAddImage(doc, input.company.logoDataUrl, MARGIN_X, 13, 24, 24);
  const textX = hasLogo ? 45 : MARGIN_X;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(GOLD);
  doc.text('ESCRITÓRIO EMISSOR', textX, 15);
  doc.setFontSize(13);
  doc.setTextColor(NAVY);
  const companyLines = doc.splitTextToSize(companyName.toUpperCase(), 105) as string[];
  doc.text(companyLines.slice(0, 2), textX, 22, { lineHeightFactor: 1.05 });

  doc.setFillColor('#f8fafc');
  doc.setDrawColor(LIGHT_LINE);
  doc.roundedRect(166, 12, 28, 18, 2, 2, 'FD');
  doc.setFontSize(6.5);
  doc.setTextColor(SLATE);
  doc.text('EMITIDO EM', 180, 18, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(NAVY);
  doc.text(formatGeneratedAt(input.generatedAt), 180, 23, { align: 'center', maxWidth: 24 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(SLATE);
  doc.text(`CNPJ: ${formatCnpj(input.company.cnpj)}`, textX, 37);
  doc.text(`Telefone: ${input.company.telefone || 'Não informado'}`, 93, 37);
  doc.text(`E-mail: ${input.company.email || 'Não informado'}`, 139, 37, { maxWidth: 55 });
  const address = [
    [input.company.endereco, input.company.numero].filter(Boolean).join(', '),
    [input.company.cidade, input.company.estado].filter(Boolean).join(' / '),
    input.company.cep ? `CEP: ${input.company.cep}` : '',
  ].filter(Boolean).join(' — ') || 'Endereço não informado';
  doc.text(address, textX, 44, { maxWidth: PAGE_WIDTH - textX - MARGIN_X });

  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, 50, PAGE_WIDTH - MARGIN_X, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(NAVY);
  doc.text('RELATÓRIO TÉCNICO DE SIMULAÇÃO', PAGE_WIDTH / 2, 61, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(GOLD);
  doc.text(input.title.toUpperCase(), PAGE_WIDTH / 2, 68, { align: 'center' });
  return 78;
};

const measureRow = (doc: JsPdfDocument, row: SimulationPdfRow) => {
  doc.setFontSize(8.5);
  const labelLines = doc.splitTextToSize(row.label, 76) as string[];
  const valueLines = doc.splitTextToSize(row.value || '—', 91) as string[];
  return {
    labelLines,
    valueLines,
    height: Math.max(8, (Math.max(labelLines.length, valueLines.length) * 4.1) + 3),
  };
};

export const generateSimulationPdf = async (input: SimulationPdfInput): Promise<GeneratedSimulationPdf> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  let pageNumber = 1;
  let y = drawPageHeader(doc, input, true);

  const addPage = () => {
    doc.addPage('a4', 'portrait');
    pageNumber += 1;
    y = drawPageHeader(doc, input, false);
  };

  input.sections.forEach((section) => {
    const firstRowHeight = section.rows[0] ? measureRow(doc, section.rows[0]).height : 0;
    if (y + 12 + firstRowHeight > CONTENT_BOTTOM) addPage();

    doc.setFillColor('#f8fafc');
    doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(NAVY);
    doc.text(section.title.toUpperCase(), MARGIN_X + 3, y + 5.4);
    y += 11;

    section.rows.forEach((row) => {
      const measured = measureRow(doc, row);
      if (y + measured.height > CONTENT_BOTTOM) addPage();

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(SLATE);
      doc.text(measured.labelLines, MARGIN_X, y + 3.5, { lineHeightFactor: 1.15 });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(NAVY);
      doc.text(measured.valueLines, PAGE_WIDTH - MARGIN_X, y + 3.5, {
        align: 'right',
        lineHeightFactor: 1.15,
      });
      doc.setDrawColor('#e8edf3');
      doc.setLineWidth(0.2);
      doc.line(MARGIN_X, y + measured.height - 1, PAGE_WIDTH - MARGIN_X, y + measured.height - 1);
      y += measured.height;
    });
    y += 5;
  });

  if (y + 20 > CONTENT_BOTTOM) addPage();
  doc.setFillColor('#f8fafc');
  doc.setDrawColor(LIGHT_LINE);
  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, 16, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.7);
  doc.setTextColor(SLATE);
  doc.text(
    doc.splitTextToSize(
      'Resultado estimado com os parâmetros informados. Confira documentos, regras e obrigações oficiais antes de qualquer apuração ou transmissão.',
      CONTENT_WIDTH - 8,
    ),
    MARGIN_X + 4,
    y + 6,
    { lineHeightFactor: 1.25 },
  );

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawFooter(doc, input, page, totalPages);
  }

  return {
    bytes: new Uint8Array(doc.output('arraybuffer')),
    pageCount: totalPages,
  };
};

export const imageUrlToDataUrl = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export const pdfBytesToDataUrl = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
};
