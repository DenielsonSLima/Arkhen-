import React, { useEffect, useState } from 'react';

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
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!bytes) {
      setPages([]);
      setPreviewError('');
      return () => { cancelled = true; };
    }

    const renderPages = async () => {
      try {
        setPreviewError('');
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).href;
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

        if (!cancelled) setPages(rendered);
      } catch (renderError) {
        console.error('Erro ao renderizar pré-visualização do PDF.', renderError);
        if (!cancelled) {
          setPages([]);
          setPreviewError('Não foi possível exibir as páginas do PDF. O download continua disponível.');
        }
      }
    };

    void renderPages();
    return () => { cancelled = true; };
  }, [bytes]);

  if (loading) {
    return <div className="simulation-pdf-status">Gerando páginas A4…</div>;
  }
  if (error) {
    return <div className="simulation-pdf-status simulation-pdf-status--error">{error}</div>;
  }
  if (previewError) {
    return <div className="simulation-pdf-status simulation-pdf-status--error">{previewError}</div>;
  }
  if (!pages.length) {
    return <div className="simulation-pdf-status">Preparando pré-visualização…</div>;
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
