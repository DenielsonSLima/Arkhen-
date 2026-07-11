import React, { useEffect, useMemo, useState } from 'react';
import type { CompanyDocument } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import { parseFiscalXml } from './shared/xmlFiscalParser';
import { XmlFiscalLayout } from './shared/XmlFiscalLayout';
import { NfseXmlViewer } from './nfse/NfseXmlViewer';
import { NfceXmlViewer } from './nfce/NfceXmlViewer';
import { NfeXmlViewer } from './nfe/NfeXmlViewer';
import { CteXmlViewer } from './cte/CteXmlViewer';
import { MdfeXmlViewer } from './mdfe/MdfeXmlViewer';
import { CanceladoXmlViewer } from './cancelado/CanceladoXmlViewer';

interface XmlFiscalViewerProps {
  document: CompanyDocument;
}

export const isXmlDocument = (document: Pick<CompanyDocument, 'nome' | 'mimeType'>) => {
  const ext = document.nome.split('.').pop()?.toLowerCase();
  return ext === 'xml' || document.mimeType === 'application/xml' || document.mimeType === 'text/xml';
};

export const XmlFiscalViewer: React.FC<XmlFiscalViewerProps> = ({ document }) => {
  const [xmlText, setXmlText] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadXml = async () => {
      if (!document.url) {
        setStatus('error');
        setError('Não foi possível gerar a URL assinada deste XML.');
        return;
      }

      try {
        setStatus('loading');
        const response = await fetch(document.url);
        if (!response.ok) throw new Error('Falha ao carregar o arquivo XML.');
        const text = await response.text();
        if (!cancelled) {
          setXmlText(text);
          setStatus('ready');
        }
      } catch (loadError) {
        if (!cancelled) {
          setStatus('error');
          setError(loadError instanceof Error ? loadError.message : 'Erro desconhecido ao carregar XML.');
        }
      }
    };

    loadXml();
    return () => {
      cancelled = true;
    };
  }, [document.url]);

  const summary = useMemo(() => (xmlText ? parseFiscalXml(xmlText) : null), [xmlText]);

  if (status === 'loading') {
    return (
      <div className="xml-fiscal-viewer">
        <div className="xml-fiscal-inner">
          <section className="xml-fiscal-hero">
            <div>
              <p className="xml-fiscal-kicker">XML fiscal</p>
              <h2>Carregando visualizador</h2>
              <p>{document.nome}</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (status === 'error' || !summary) {
    return (
      <div className="xml-fiscal-viewer">
        <div className="xml-fiscal-inner">
          <section className="xml-fiscal-hero">
            <div>
              <p className="xml-fiscal-kicker">XML fiscal</p>
              <h2>Não foi possível abrir o XML</h2>
              <p>{error || 'Arquivo sem conteúdo para visualização.'}</p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  switch (summary.kind) {
    case 'nfse':
      return <NfseXmlViewer summary={summary} />;
    case 'nfce':
      return <NfceXmlViewer summary={summary} />;
    case 'nfe':
      return <NfeXmlViewer summary={summary} />;
    case 'cte':
      return <CteXmlViewer summary={summary} />;
    case 'mdfe':
      return <MdfeXmlViewer summary={summary} />;
    case 'cancelado':
      return <CanceladoXmlViewer summary={summary} />;
    default:
      return <XmlFiscalLayout summary={summary} />;
  }
};
