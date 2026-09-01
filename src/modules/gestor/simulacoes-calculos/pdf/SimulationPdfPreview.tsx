import React, { useEffect, useState } from 'react';

interface SimulationPdfPreviewProps {
  bytes: Uint8Array | null;
  loading: boolean;
  error: string;
}

export const SimulationPdfPreview: React.FC<SimulationPdfPreviewProps> = ({ bytes, loading, error }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    setPreviewError(false);
    if (!bytes) {
      setBlobUrl(null);
      return undefined;
    }

    let nextUrl: string | null = null;
    try {
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      nextUrl = URL.createObjectURL(blob);
      setBlobUrl(nextUrl);
    } catch {
      setBlobUrl(null);
      setPreviewError(true);
    }

    return () => {
      if (nextUrl) {
        URL.revokeObjectURL(nextUrl);
      }
    };
  }, [bytes]);

  if (loading) {
    return <div className="simulation-pdf-status" role="status" aria-live="polite">Gerando documento A4…</div>;
  }

  if (error) {
    return <div className="simulation-pdf-status simulation-pdf-status--error" role="alert" aria-live="assertive">{error}</div>;
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

  if (bytes && !previewError) {
    return <div className="simulation-pdf-status" role="status" aria-live="polite">Preparando pré-visualização…</div>;
  }

  return (
    <div className="simulation-pdf-status" role="status" aria-live="polite">
      Pré-visualização indisponível. O download do PDF continua ativo.
    </div>
  );
};
