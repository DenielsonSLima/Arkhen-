import QRCode from 'qrcode';
import type { jsPDF } from 'jspdf';
import { validationUrl, type NfseModeloOptions } from './modelo';

export function resolveQrCode(payload: string, options: NfseModeloOptions) {
  const portal = validationUrl(options.ambiente);
  if (!portal) return { payload: '', caption: 'Ambiente não identificado' };
  const supplied = payload.trim();
  if (!options.demonstracao && supplied) {
    try {
      const url = new URL(supplied);
      if (['https:', 'http:'].includes(url.protocol) && url.hostname === new URL(portal).hostname
        && !url.username && !url.password && !url.port && url.pathname.startsWith('/externo/nfse/')) {
        return { payload: url.href, caption: 'Escaneie para consultar no WebISS' };
      }
    } catch { /* O QR original do WebISS também pode conter um token opaco. */ }
    if (supplied.length >= 40 && supplied.length <= 1024 && /^[A-Za-z0-9+/]+={0,2}$/.test(supplied)) {
      return { payload: supplied, caption: 'Leia no portal WebISS: Validar NFS-e pelo QRCode' };
    }
  }
  return { payload: portal, caption: 'Escaneie e informe o código de verificação' };
}

/** Módulos vetoriais com área branca de quatro módulos em cada borda. */
export function drawQrCode(pdf: jsPDF, payload: string, x: number, y: number, size: number) {
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const unit = size / (modules.size + 8);
  pdf.setFillColor('#ffffff').rect(x, y, size, size, 'F');
  pdf.setFillColor('#000000');
  for (let row = 0; row < modules.size; row += 1) {
    for (let col = 0; col < modules.size; col += 1) {
      if (!modules.get(row, col)) continue;
      const start = col;
      while (col + 1 < modules.size && modules.get(row, col + 1)) col += 1;
      pdf.rect(x + (start + 4) * unit, y + (row + 4) * unit, (col - start + 1) * unit, unit, 'F');
    }
  }
}
