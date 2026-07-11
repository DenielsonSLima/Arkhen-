import React from 'react';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';
import { NfcePdfDocument } from './NfcePdfDocument';

export const NfceXmlViewer: React.FC<{ summary: XmlFiscalSummary }> = ({ summary }) => (
  <NfcePdfDocument summary={summary} />
);
