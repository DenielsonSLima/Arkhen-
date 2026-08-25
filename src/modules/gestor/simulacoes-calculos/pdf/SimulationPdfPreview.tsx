import React from 'react';

interface SimulationPdfPreviewProps {
  pdfDataUrl: string;
  pageCount?: number;
}

export const SimulationPdfPreview: React.FC<SimulationPdfPreviewProps> = ({ pdfDataUrl, pageCount }) => {
  if (!pdfDataUrl) {
    return <div className="simulation-pdf-status">Pré-visualização indisponível. O download do PDF continua ativo.</div>;
  }

  return (
    <div className="simulation-pdf-fallback-container" style={{ width: '100%', height: '100%' }}>
      <iframe
        src={`${pdfDataUrl}#toolbar=0&navpanes=0`}
        title={`Pré-visualização do PDF${pageCount ? ` (${pageCount} página${pageCount === 1 ? '' : 's'})` : ''}`}
        className="simulation-pdf-iframe"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
};
