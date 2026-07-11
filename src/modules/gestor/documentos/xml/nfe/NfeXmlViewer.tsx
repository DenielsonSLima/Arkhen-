import React from 'react';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';
import { NfePdfDocument } from './NfePdfDocument';

export const NfeXmlViewer: React.FC<{ summary: XmlFiscalSummary }> = ({ summary }) => (
  <NfePdfDocument summary={summary} />
);
