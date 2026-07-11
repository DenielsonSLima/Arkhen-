import React from 'react';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';
import { CtePdfDocument } from './CtePdfDocument';

export const CteXmlViewer: React.FC<{ summary: XmlFiscalSummary }> = ({ summary }) => (
  <CtePdfDocument summary={summary} />
);
