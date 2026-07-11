import React from 'react';
import { FiscalField, FiscalPdfShell } from '../shared/FiscalPdfDocument';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';

export const NfePdfDocument: React.FC<{ summary: XmlFiscalSummary }> = ({ summary }) => (
  <FiscalPdfShell
    summary={summary}
    documentTitle="DANFE - Nota Fiscal Eletrônica"
    auxiliaryTitle="Documento Auxiliar da Nota Fiscal Eletrônica"
    watermark="NF-E"
  >
    <section className="fiscal-pdf-box">
      <h3>Controle do Fisco</h3>
      <div className="fiscal-pdf-grid">
        <FiscalField label="Tipo" value="NF-e de venda" />
        <FiscalField label="Finalidade" value="Documento auxiliar de mercadoria" />
        <FiscalField label="Arquivo de origem" value="XML autorizado" />
      </div>
    </section>
  </FiscalPdfShell>
);
