import React, { useEffect, useMemo, useState } from 'react';

interface PreviewPage {
  pageNumber: number;
  dataUrl: string;
}

interface SimulationPdfPreviewProps {
  bytes: Uint8Array | null;
  loading: boolean;
  error: string;
}

export const SimulationPdfPreview: React.FC<SimulationPdfPreviewProps> = ({ bytes, loading, error }) => {
  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const fallbackBlobUrl = useMemo(() => {
    if (!bytes) return null;
    try {
      const blob = new Blob([bytes], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }, [bytes]);

  useEffect(() => {
    return () => {
      if (fallbackBlobUrl) {
        URL.revokeObjectURL(fallbackBlobUrl);
      }
    };
  }, [fallbackBlobUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!bytes) {
      setPages([]);
      setIsRendering(false);
      setUseFallback(false);
      return () => { cancelled = true; };
    }

    setIsRendering(true);
    setUseFallback(false);

    const timer = setTimeout(() => {
      if (!cancelled && pages.length === 0) {
        setUseFallback(true);
        setIsRendering(false);
      }
    }, 3500);

    const renderPages = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        }
        const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
        const rendered: PreviewPage[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.65 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Não foi possível preparar a página para visualização.');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          rendered.push({ pageNumber, dataUrl: canvas.toDataURL('image/png') });
        }

        if (!cancelled) {
          setPages(rendered);
          setIsRendering(false);
          clearTimeout(timer);
        }
      } catch (renderError) {
        console.warn('Fallback para visualizador nativo de PDF.', renderError);
        if (!cancelled) {
          setUseFallback(true);
          setIsRendering(false);
          clearTimeout(timer);
        }
      }
    };

    void renderPages();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bytes]);

  if (loading) {
    return <div className="simulation-pdf-status">Gerando documento A4…</div>;
  }
  if (error) {
    return <div className="simulation-pdf-status simulation-pdf-status--error">{error}</div>;
  }

  if (useFallback && fallbackBlobUrl) {
    return (
      <div className="simulation-pdf-fallback-container">
        <iframe
          src={`${fallbackBlobUrl}#toolbar=0&navpanes=0`}
          title="Pré-visualização do PDF"
          className="simulation-pdf-iframe"
        />
      </div>
    );
  }

  if (isRendering && !pages.length) {
    return <div className="simulation-pdf-status">Preparando pré-visualização…</div>;
  }

  if (!pages.length) {
    return <div className="simulation-pdf-status">Pré-visualização indisponível. O download do PDF continua ativo.</div>;
  }

  return (
    <div className="simulation-pdf-pages" aria-label={`Pré-visualização com ${pages.length} página(s)`}>
      {pages.map((page) => (
        <figure className="simulation-pdf-sheet" key={page.pageNumber}>
          <img src={page.dataUrl} alt={`Página ${page.pageNumber} de ${pages.length}`} />
          <figcaption>Página {page.pageNumber} de {pages.length}</figcaption>
        </figure>
      ))}
    </div>
  );
};
