import type { jsPDF as JsPdfDocument } from 'jspdf';
import type {
  GeneratedSimulationPdf,
  SimulationPdfInput,
  SimulationPdfRow,
} from './simulationPdfTypes';
import { resolveWatermarkGeometry } from './watermarkConfig';

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
  const normalized = dataUrl.toLowerCase();
  if (normalized.startsWith('data:image/jpeg') || normalized.startsWith('data:image/jpg')) return 'JPEG';
  if (normalized.startsWith('data:image/webp')) return 'WEBP';
  if (normalized.startsWith('data:image/png')) return 'PNG';
  throw new Error('Formato de imagem incompatível com o PDF.');
};

const isSvgDataUrl = (dataUrl: string) => /^data:image\/svg\+xml(?:;|,)/i.test(dataUrl);

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
  if (!watermark?.enabled) return;
  if (!watermark.dataUrl) {
    throw new Error('A marca d’água Retrato está habilitada, mas a imagem não está disponível.');
  }
  const geometry = resolveWatermarkGeometry({
    watermark,
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
  });

  const pdfWithState = doc as JsPdfDocument & {
    GState: new (options: { opacity: number }) => unknown;
    setGState: (state: unknown) => void;
  };
  try {
    pdfWithState.setGState(new pdfWithState.GState({ opacity: geometry.opacity }));
    doc.addImage(
      watermark.dataUrl,
      imageFormat(watermark.dataUrl),
      geometry.x,
      geometry.y,
      geometry.width,
      geometry.height,
      undefined,
      'FAST',
    );
  } catch (cause) {
    throw new Error('Não foi possível aplicar a marca d’água Retrato configurada no PDF.', { cause });
  } finally {
    pdfWithState.setGState(new pdfWithState.GState({ opacity: 1 }));
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
    doc.text(companyName.toUpperCase(), MARGIN_X, 12);
    doc.setFontSize(8);
    doc.setTextColor(GOLD);
    doc.text(input.title.toUpperCase(), PAGE_WIDTH - MARGIN_X, 12, { align: 'right' });
    doc.setDrawColor(GOLD);
    doc.setLineWidth(0.4);
    doc.line(MARGIN_X, 16, PAGE_WIDTH - MARGIN_X, 16);
    return 22;
  }

  const hasLogo = safeAddImage(doc, input.company.logoDataUrl, MARGIN_X, 10, 20, 20);
  const textX = hasLogo ? 40 : MARGIN_X;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(GOLD);
  doc.text('ESCRITÓRIO EMISSOR', textX, 13);

  doc.setFontSize(11);
  doc.setTextColor(NAVY);
  const companyLines = doc.splitTextToSize(companyName.toUpperCase(), 110) as string[];
  doc.text(companyLines.slice(0, 2), textX, 18, { lineHeightFactor: 1.05 });
  const companyHeight = (Math.min(companyLines.length, 2) - 1) * 4.5;

  doc.setFillColor('#f8fafc');
  doc.setDrawColor(LIGHT_LINE);
  doc.roundedRect(168, 10, 26, 15, 1.5, 1.5, 'FD');
  doc.setFontSize(6);
  doc.setTextColor(SLATE);
  doc.text('EMITIDO EM', 181, 14.5, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(NAVY);
  doc.text(formatGeneratedAt(input.generatedAt), 181, 19.5, { align: 'center', maxWidth: 24 });

  const infoY = 24 + companyHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(SLATE);
  doc.text(`CNPJ: ${formatCnpj(input.company.cnpj)}`, textX, infoY);
  doc.text(`Telefone: ${input.company.telefone || 'Não informado'}`, 90, infoY);
  doc.text(`E-mail: ${input.company.email || 'Não informado'}`, 135, infoY, { maxWidth: 55 });

  const address = [
    [input.company.endereco, input.company.numero].filter(Boolean).join(', '),
    [input.company.cidade, input.company.estado].filter(Boolean).join(' / '),
    input.company.cep ? `CEP: ${input.company.cep}` : '',
  ].filter(Boolean).join(' — ') || 'Endereço não informado';
  doc.text(address, textX, infoY + 4.5, { maxWidth: PAGE_WIDTH - textX - MARGIN_X });

  const lineY = Math.max(32, infoY + 9);
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_X, lineY, PAGE_WIDTH - MARGIN_X, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(NAVY);
  doc.text('RELATÓRIO TÉCNICO DE SIMULAÇÃO', PAGE_WIDTH / 2, lineY + 6.5, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setTextColor(GOLD);
  doc.text(input.title.toUpperCase(), PAGE_WIDTH / 2, lineY + 11.5, { align: 'center' });

  return lineY + 17;
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
  const logoPromise = normalizeSvgForPdf(input.company.logoDataUrl).catch((error) => {
    console.warn('Logotipo ignorado durante a geração do PDF.', error);
    return null;
  });
  const watermarkPromise = input.watermark?.enabled
    ? normalizeSvgForPdf(input.watermark.dataUrl)
    : Promise.resolve(input.watermark?.dataUrl ?? null);
  const [logoDataUrl, watermarkDataUrl] = await Promise.all([
    logoPromise,
    watermarkPromise,
  ]);
  const preparedInput: SimulationPdfInput = {
    ...input,
    company: { ...input.company, logoDataUrl },
    watermark: input.watermark
      ? { ...input.watermark, dataUrl: watermarkDataUrl }
      : undefined,
  };
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  let pageNumber = 1;
  let y = drawPageHeader(doc, preparedInput, true);

  const addPage = () => {
    doc.addPage('a4', 'portrait');
    pageNumber += 1;
    y = drawPageHeader(doc, preparedInput, false);
  };

  preparedInput.sections.forEach((section) => {
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
    drawFooter(doc, preparedInput, page, totalPages);
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

const loadImage = (dataUrl: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  if (typeof Image === 'undefined') {
    reject(new Error('O ambiente atual não oferece suporte ao processamento de imagens.'));
    return;
  }
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Não foi possível decodificar a imagem configurada.'));
  image.src = dataUrl;
});

const rasterizeSvgDataUrl = async (dataUrl: string): Promise<{ dataUrl: string; aspectRatio: number }> => {
  if (typeof document === 'undefined') {
    throw new Error('O ambiente atual não oferece suporte à conversão da imagem SVG.');
  }
  const image = await loadImage(dataUrl);
  const naturalWidth = image.naturalWidth || image.width || 1600;
  const naturalHeight = image.naturalHeight || image.height || 1600;
  const aspectRatio = naturalWidth / naturalHeight;
  const width = Math.max(1, Math.min(2400, naturalWidth));
  const height = Math.max(1, Math.round(width / aspectRatio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Não foi possível preparar a imagem SVG para o PDF.');
  }
  context.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/png'), aspectRatio };
};

const normalizeSvgForPdf = async (
  dataUrl: string | null | undefined,
): Promise<string | null> => {
  if (!dataUrl) return null;
  if (!isSvgDataUrl(dataUrl)) return dataUrl;
  const rasterized = await rasterizeSvgDataUrl(dataUrl);
  return rasterized.dataUrl;
};

export const getImageDetails = async (
  url: string | null | undefined
): Promise<{ dataUrl: string | null; aspectRatio: number }> => {
  if (!url) return { dataUrl: null, aspectRatio: 1 };
  const dataUrl = await imageUrlToDataUrl(url);
  if (!dataUrl) return { dataUrl: null, aspectRatio: 1 };

  if (isSvgDataUrl(dataUrl)) {
    try {
      return await rasterizeSvgDataUrl(dataUrl);
    } catch {
      return { dataUrl: null, aspectRatio: 1 };
    }
  }

  try {
    const image = await loadImage(dataUrl);
    const naturalWidth = image.naturalWidth || image.width || 100;
    const naturalHeight = image.naturalHeight || image.height || 100;
    return { dataUrl, aspectRatio: naturalWidth / naturalHeight };
  } catch {
    return { dataUrl, aspectRatio: 1 };
  }
};
