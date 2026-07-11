import React from 'react';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';
import { MdfePdfDocument } from './MdfePdfDocument';

export const MdfeXmlViewer: React.FC<{ summary: XmlFiscalSummary }> = ({ summary }) => (
  <MdfePdfDocument summary={summary} />
);
