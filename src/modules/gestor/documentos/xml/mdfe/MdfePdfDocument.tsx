import React from 'react';
import { FiscalField, FiscalPdfShell } from '../shared/FiscalPdfDocument';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';

export const MdfePdfDocument: React.FC<{ summary: XmlFiscalSummary }> = ({ summary }) => (
  <FiscalPdfShell
    summary={summary}
    documentTitle="DAMDFE - Manifesto Eletrônico de Documentos Fiscais"
    auxiliaryTitle="Documento Auxiliar do MDF-e"
    watermark="MDF-E"
  >
    <section className="fiscal-pdf-box">
      <h3>Manifesto de Carga</h3>
      <div className="fiscal-pdf-grid">
        <FiscalField label="Tipo" value="Manifesto eletrônico" />
        <FiscalField label="Documento" value="DAMDFE" />
        <FiscalField label="Origem" value="XML MDF-e autorizado" />
      </div>
    </section>
  </FiscalPdfShell>
);
