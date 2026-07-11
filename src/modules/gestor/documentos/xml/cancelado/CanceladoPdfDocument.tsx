import React from 'react';
import { FiscalField, FiscalPdfShell } from '../shared/FiscalPdfDocument';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';

export const CanceladoPdfDocument: React.FC<{ summary: XmlFiscalSummary }> = ({ summary }) => (
  <FiscalPdfShell
    summary={summary}
    documentTitle="Evento de Cancelamento"
    auxiliaryTitle="Documento Auxiliar de XML Fiscal Cancelado"
    watermark="CANCELADO"
  >
    <section className="fiscal-pdf-box">
      <h3>Evento Fiscal</h3>
      <div className="fiscal-pdf-grid">
        <FiscalField label="Situação" value="Cancelado" />
        <FiscalField label="Motivo" value={summary.status} />
        <FiscalField label="Arquivo de origem" value="XML de evento" />
      </div>
    </section>
  </FiscalPdfShell>
);
