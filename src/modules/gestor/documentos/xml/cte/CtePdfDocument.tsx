import React from 'react';
import { FiscalField, FiscalPdfShell } from '../shared/FiscalPdfDocument';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';

export const CtePdfDocument: React.FC<{ summary: XmlFiscalSummary }> = ({ summary }) => (
  <FiscalPdfShell
    summary={summary}
    documentTitle="DACTE - Conhecimento de Transporte Eletrônico"
    auxiliaryTitle="Documento Auxiliar do CT-e"
    watermark="CT-E"
  >
    <section className="fiscal-pdf-box">
      <h3>Dados do Transporte</h3>
      <div className="fiscal-pdf-grid">
        <FiscalField label="Tipo" value="Conhecimento de transporte" />
        <FiscalField label="Documento" value="DACTE" />
        <FiscalField label="Origem" value="XML CT-e autorizado" />
      </div>
    </section>
  </FiscalPdfShell>
);
