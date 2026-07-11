import React from 'react';
import type { XmlFiscalSummary } from './xmlFiscalTypes';
import './XmlFiscalLayout.css';

interface XmlFiscalLayoutProps {
  summary: XmlFiscalSummary;
}

export const XmlFiscalLayout: React.FC<XmlFiscalLayoutProps> = ({ summary }) => (
  <div className="xml-fiscal-viewer">
    <div className="xml-fiscal-inner">
      <section className="xml-fiscal-hero">
        <div>
          <p className="xml-fiscal-kicker">{summary.label}</p>
          <h2>{summary.title}</h2>
          <p>{summary.subtitle}</p>
        </div>
        <span className={`xml-fiscal-status ${summary.isCanceled ? 'cancelado' : ''}`}>
          {summary.status}
        </span>
      </section>

      <div className="xml-fiscal-grid">
        {summary.sections.map((section) => (
          <section className="xml-fiscal-section" key={section.title}>
            <h3>{section.title}</h3>
            <div className="xml-fiscal-fields">
              {section.fields.map((field) => (
                <div className="xml-fiscal-field" key={`${section.title}-${field.label}`}>
                  <span>{field.label}</span>
                  <span>{field.value}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <details className="xml-fiscal-raw">
        <summary>XML bruto</summary>
        <pre>{summary.rawXml}</pre>
      </details>
    </div>
  </div>
);
