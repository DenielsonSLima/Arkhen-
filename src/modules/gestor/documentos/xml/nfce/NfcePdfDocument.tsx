import React from 'react';
import { FiscalField, FiscalPdfShell } from '../shared/FiscalPdfDocument';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';

const QrPreview: React.FC<{ value: string }> = ({ value }) => {
  const seed = value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return (
    <div style={{ width: 92, height: 92, display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 2, border: '1px solid #111827', padding: 5 }}>
      {Array.from({ length: 121 }, (_, index) => (
        <span key={index} style={{ background: (index + seed) % 3 === 0 || index % 13 === 0 ? '#111827' : '#ffffff' }} />
      ))}
    </div>
  );
};

export const NfcePdfDocument: React.FC<{ summary: XmlFiscalSummary }> = ({ summary }) => (
  <FiscalPdfShell
    summary={summary}
    documentTitle="DANFE NFC-e"
    auxiliaryTitle="Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica"
    watermark="NFC-E"
  >
    <section className="fiscal-pdf-box">
      <h3>Consulta via QR Code</h3>
      <div className="fiscal-pdf-grid">
        <div className="fiscal-field fiscal-field-wide" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <QrPreview value={summary.subtitle} />
          <div>
            <FiscalField label="Tipo" value="Cupom fiscal eletrônico" />
            <FiscalField label="Ambiente" value="Consumidor final" />
          </div>
        </div>
      </div>
    </section>
  </FiscalPdfShell>
);
