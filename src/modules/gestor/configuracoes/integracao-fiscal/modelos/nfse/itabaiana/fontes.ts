import normalUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';
import boldUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url';
import italicUrl from 'pdfjs-dist/standard_fonts/LiberationSans-BoldItalic.ttf?url';
import type { jsPDF } from 'jspdf';

export type NfseFontes = Record<'normal' | 'bold' | 'bolditalic', string>;
let loaded: Promise<NfseFontes> | undefined;
export function carregarFontes() {
  loaded ||= Promise.all([normalUrl, boldUrl, italicUrl].map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Não foi possível carregar as fontes da NFS-e.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  })).then(([normal, bold, bolditalic]) => ({ normal, bold, bolditalic })).catch((error) => { loaded = undefined; throw error; });
  return loaded;
}
export function registrarFontes(pdf: jsPDF, fontes?: NfseFontes) {
  if (!fontes) return;
  for (const [style, data] of Object.entries(fontes)) {
    const file = `LiberationSans-${style}.ttf`;
    pdf.addFileToVFS(file, data);
    // Usa o mesmo nome interno para evitar diferenças entre campos e cabeçalho.
    pdf.addFont(file, 'helvetica', style);
  }
}
