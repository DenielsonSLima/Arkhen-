import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, FileText, Loader2, TriangleAlert } from 'lucide-react';
import './TextDocumentViewer.css';

const MAX_PREVIEW_BYTES = 5 * 1024 * 1024;
const MAX_RENDERED_CHARACTERS = 1_000_000;

const readResponseWithLimit = async (response: Response) => {
  if (!response.body) {
    const fallbackBuffer = await response.arrayBuffer();
    if (fallbackBuffer.byteLength > MAX_PREVIEW_BYTES) {
      throw new Error('O arquivo ultrapassa 5 MB. Baixe-o para consultar o conteúdo completo.');
    }
    return fallbackBuffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PREVIEW_BYTES) {
      await reader.cancel();
      throw new Error('O arquivo ultrapassa 5 MB. Baixe-o para consultar o conteúdo completo.');
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(totalBytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return joined.buffer;
};

const copyTextWithFallback = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Safari em HTTP local pode expor a API e rejeitar a escrita.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.inset = '0 auto auto -9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Não foi possível copiar automaticamente.');
};

const decodeText = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'UTF-16 LE' };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'UTF-16 BE' };
  }

  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'Windows-1252' };
  }
};

interface TextDocumentViewerProps {
  sourceUrl: string;
  fileName: string;
  sizeBytes?: number | null;
}

export const TextDocumentViewer: React.FC<TextDocumentViewerProps> = ({ sourceUrl, fileName, sizeBytes }) => {
  const [content, setContent] = useState('');
  const [encoding, setEncoding] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const controller = new AbortController();

    const loadText = async () => {
      if (sizeBytes && sizeBytes > MAX_PREVIEW_BYTES) {
        setError('O arquivo ultrapassa 5 MB. Baixe-o para consultar o conteúdo completo.');
        setStatus('error');
        return;
      }

      try {
        setStatus('loading');
        setError('');
        const response = await fetch(sourceUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`Falha ao carregar o arquivo (${response.status}).`);

        const announcedSize = Number(response.headers.get('content-length') || 0);
        if (announcedSize > MAX_PREVIEW_BYTES) {
          throw new Error('O arquivo ultrapassa 5 MB. Baixe-o para consultar o conteúdo completo.');
        }

        const buffer = await readResponseWithLimit(response);
        const decoded = decodeText(buffer);
        setContent(decoded.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'));
        setEncoding(decoded.encoding);
        setStatus('ready');
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível ler o arquivo.');
        setStatus('error');
      }
    };

    void loadText();
    return () => controller.abort();
  }, [sizeBytes, sourceUrl]);

  const visibleContent = content.slice(0, MAX_RENDERED_CHARACTERS);
  const isTruncated = visibleContent.length < content.length;
  const lines = useMemo(() => (content ? content.split('\n').length : 0), [content]);

  const copyContent = async () => {
    try {
      await copyTextWithFallback(content);
      setCopyStatus('success');
      window.setTimeout(() => setCopyStatus('idle'), 1_500);
    } catch {
      setCopyStatus('error');
      window.setTimeout(() => setCopyStatus('idle'), 3_000);
    }
  };

  if (status === 'loading') {
    return (
      <div className="text-document-state">
        <Loader2 className="animate-spin" size={28} />
        <strong>Lendo arquivo de texto…</strong>
        <span>Preparando uma visualização segura.</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-document-state text-document-state--error" role="alert">
        <TriangleAlert size={30} />
        <strong>Não foi possível visualizar</strong>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <section className="text-document-viewer" aria-label={`Conteúdo de ${fileName}`}>
      <header className="text-document-toolbar">
        <div>
          <FileText size={16} />
          <strong>Texto original</strong>
          <span>{encoding} · {lines} {lines === 1 ? 'linha' : 'linhas'}</span>
        </div>
        <button type="button" onClick={copyContent} disabled={!content} title={copyStatus === 'error' ? 'Selecione o texto e copie manualmente.' : undefined}>
          {copyStatus === 'success' ? <Check size={15} /> : <Copy size={15} />}
          {copyStatus === 'success' ? 'Copiado' : copyStatus === 'error' ? 'Selecione e copie' : 'Copiar texto'}
        </button>
      </header>
      {isTruncated ? (
        <div className="text-document-warning">Prévia limitada ao primeiro milhão de caracteres. O download mantém o arquivo completo.</div>
      ) : null}
      <pre className="text-document-content" tabIndex={0}>{visibleContent || 'Arquivo sem conteúdo.'}</pre>
    </section>
  );
};
