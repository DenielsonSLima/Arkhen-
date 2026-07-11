import React from 'react';
import type { XmlFiscalSummary } from '../shared/xmlFiscalTypes';
import { NfsePdfDocument } from './NfsePdfDocument';
import type { NfseVisualIdentityOptions } from './nfseVisualIdentity';

interface NfseXmlViewerProps extends NfseVisualIdentityOptions {
  summary: XmlFiscalSummary;
}

export const NfseXmlViewer: React.FC<NfseXmlViewerProps> = ({ summary, ...identityOptions }) => (
  <NfsePdfDocument summary={summary} {...identityOptions} />
);
