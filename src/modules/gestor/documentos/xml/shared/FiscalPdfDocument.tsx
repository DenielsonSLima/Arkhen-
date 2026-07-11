import React from 'react';
import type { XmlFiscalSection, XmlFiscalSummary } from './xmlFiscalTypes';
import './FiscalPdfDocument.css';

export const fiscalSafeValue = (value?: string) => value || '-';

export const FiscalBarcode: React.FC<{ value: string }> = ({ value }) => {
  const source = value || '00000000000000000000000000000000000000000000';
  return (
    <div className="fiscal-barcode" aria-label="Codigo de barras">
      {Array.from({ length: 74 }, (_, index) => {
        const code = source.charCodeAt(index % source.length) || index;
        const width = code % 4 === 0 ? 3 : code % 3 === 0 ? 2 : 1;
        return <span key={index} style={{ width }} />;
      })}
    </div>
  );
};

export const FiscalField: React.FC<{ label: string; value?: string; wide?: boolean }> = ({ label, value, wide }) => (
  <div className={wide ? 'fiscal-field fiscal-field-wide' : 'fiscal-field'}>
    <span>{label}</span>
    <strong>{fiscalSafeValue(value)}</strong>
  </div>
);

export const FiscalSectionGrid: React.FC<{ section: XmlFiscalSection }> = ({ section }) => (
  <section className="fiscal-pdf-box">
    <h3>{section.title}</h3>
    <div className="fiscal-pdf-grid">
      {section.fields.map((field) => (
        <FiscalField key={`${section.title}-${field.label}`} label={field.label} value={field.value} />
      ))}
    </div>
  </section>
);

interface FiscalPdfShellProps {
  summary: XmlFiscalSummary;
  documentTitle: string;
  auxiliaryTitle: string;
  watermark: string;
  children?: React.ReactNode;
}

export const FiscalPdfShell: React.FC<FiscalPdfShellProps> = ({
  summary,
  documentTitle,
  auxiliaryTitle,
  watermark,
  children,
}) => (
  <div className="fiscal-pdf-viewer">
    <article className="fiscal-pdf-page">
      <div className="fiscal-pdf-watermark">{watermark}</div>
      <header className="fiscal-pdf-header">
        <div>
          <p className="fiscal-pdf-kicker">{auxiliaryTitle}</p>
          <h2>{documentTitle}</h2>
          <span>{summary.status}</span>
        </div>
        <div className="fiscal-pdf-key">
          <span>Chave / Identificador</span>
          <strong>{summary.subtitle}</strong>
          <FiscalBarcode value={summary.subtitle} />
        </div>
      </header>
      {children}
      {summary.sections.map((section) => (
        <FiscalSectionGrid key={section.title} section={section} />
      ))}
    </article>
  </div>
);
