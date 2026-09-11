import { useEffect, useState } from 'react';
import type { NfseFiscalData } from '../../../../../documentos/xml/shared/xmlFiscalTypes';
import type { NfseAmbiente } from './modelo';
import { carregarModelo } from './carregarModelo';

type Props = { nfse: NfseFiscalData; ambiente: NfseAmbiente; empresaNome?: string; cancelada?: boolean };

export function NfseItabaianaDocument({ nfse, ambiente, empresaNome, cancelada }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    setUrl(''); setError('');
    const create = async () => {
      try {
        const [{ gerarNfsePdf }, options] = await Promise.all([
          import('./gerarNfsePdf'), carregarModelo(nfse, { ambiente, empresaNome, cancelada }),
        ]);
        if (cancelled) return;
        const pdf = gerarNfsePdf(nfse, options);
        objectUrl = URL.createObjectURL(pdf.output('blob'));
        setUrl(objectUrl);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Não foi possível montar o PDF.');
      }
    };
    void create();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [nfse, ambiente, empresaNome, cancelada]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500, background: '#e5e7eb' }}>
      <div style={{ padding: '10px 16px', background: '#fff', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span>NFS-e {nfse.numero} · {ambiente === 'homologacao' ? 'Homologação - sem valor fiscal' : ambiente === 'producao' ? 'Produção' : 'Espelho do XML - ambiente não identificado'}</span>
        {url && <a href={url} download={`NFS-e-${nfse.numero}-${ambiente}.pdf`}>Baixar PDF</a>}
      </div>
      {error ? <p role="alert" style={{ padding: 16 }}>{error}</p> : url
        ? <iframe title={`PDF da NFS-e ${nfse.numero}`} src={url} style={{ flex: 1, width: '100%', minHeight: 650, border: 0 }} />
        : <p role="status" style={{ padding: 16 }}>Montando NFS-e…</p>}
    </div>
  );
}
