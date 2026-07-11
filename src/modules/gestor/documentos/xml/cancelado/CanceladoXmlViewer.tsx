import React from 'react';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';
import { CanceladoPdfDocument } from './CanceladoPdfDocument';

export const CanceladoXmlViewer: React.FC<{ summary: XmlFiscalSummary }> = ({ summary }) => (
  <CanceladoPdfDocument summary={summary} />
);
