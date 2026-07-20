import React, { useEffect, useMemo } from 'react';

interface SimulationPdfPreviewProps {
  bytes: Uint8Array | null;
  loading: boolean;
  error: string;
}

export const SimulationPdfPreview: React.FC<SimulationPdfPreviewProps> = ({ bytes, loading, error }) => {
  const blobUrl = useMemo(() => {
    if (!bytes) return null;
    try {
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }, [bytes]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (loading) {
    return <div className="simulation-pdf-status">Gerando documento A4…</div>;
  }

  if (error) {
    return <div className="simulation-pdf-status simulation-pdf-status--error">{error}</div>;
  }

  if (blobUrl) {
    return (
      <div className="simulation-pdf-fallback-container">
        <iframe
          src={`${blobUrl}#toolbar=0&navpanes=0`}
          title="Pré-visualização do PDF"
          className="simulation-pdf-iframe"
        />
      </div>
    );
  }

  return <div className="simulation-pdf-status">Pré-visualização indisponível. O download do PDF continua ativo.</div>;
};
