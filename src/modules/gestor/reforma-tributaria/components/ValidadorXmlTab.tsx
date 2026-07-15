import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSearch, UploadCloud, XCircle } from 'lucide-react';
import { useReformaHistoricoQuery, useValidateXmlMutation } from '../hooks/useReformaTributariaQueries';
import type { ReformaCliente } from '../services/reformaTributaria.types';
import { ClienteSelector, EmptyState } from './ReformaShared';
import { formatDate } from '../services/reformaPresentation';

interface Props { clientes: ReformaCliente[]; clienteId: string; onClientChange: (id: string) => void; }

export const ValidadorXmlTab = ({ clientes, clienteId, onClientChange }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const mutation = useValidateXmlMutation();
  const historyQuery = useReformaHistoricoQuery(clienteId || null);
  const result = mutation.data;
  const ResultIcon = result?.resultado === 'valido' ? CheckCircle2 : result?.resultado === 'alerta' ? AlertTriangle : XCircle;

  return (
    <div className="rtc-tab-stack">
      <ClienteSelector clientes={clientes} value={clienteId} onChange={(id) => { onClientChange(id); mutation.reset(); setFile(null); }} />
      {!clienteId ? <EmptyState title="Selecione um cliente" description="A validação sempre fica vinculada ao CNPJ e à sua trilha de auditoria." /> : (
        <div className="rtc-two-columns rtc-two-columns-wide-left">
          <section className="rtc-panel">
            <header className="rtc-panel-header"><div><span className="rtc-eyebrow">Validação fiscal no backend</span><h2>Conferir XML original</h2></div><FileSearch size={22} /></header>
            <label className={`rtc-upload ${file ? 'has-file' : ''}`}>
              <input type="file" accept=".xml,text/xml,application/xml" onChange={(event) => { setFile(event.target.files?.[0] || null); mutation.reset(); }} />
              <UploadCloud size={30} />
              <strong>{file?.name || 'Arraste ou selecione um XML'}</strong>
              <span>NF-e, NFC-e, NFS-e, CT-e ou MDF-e · máximo 10 MB</span>
            </label>
            <div className="rtc-validation-scope"><strong>O que será conferido</strong><div><span>CNPJ emitente</span><span>Grupo IBS/CBS</span><span>CST/cClassTrib</span><span>Itens</span><span>Base × alíquota</span><span>Hash SHA-256</span></div></div>
            {mutation.error && <div className="rtc-form-error">{mutation.error.message}</div>}
            <button type="button" className="rtc-primary-button" disabled={!file || mutation.isPending} onClick={() => file && mutation.mutate({ clienteId, file })}>
              <FileSearch size={16} /> {mutation.isPending ? 'Validando no backend...' : 'Validar e registrar evidência'}
            </button>
          </section>

          <section className="rtc-panel">
            <header className="rtc-panel-header"><div><span className="rtc-eyebrow">Resultado</span><h2>Diagnóstico do documento</h2></div></header>
            {!result ? <EmptyState title="Nenhuma validação nesta sessão" description="O resultado será gravado no histórico do cliente." /> : (
              <div className={`rtc-validation-result ${result.resultado}`}>
                <ResultIcon size={28} /><div><strong>{result.resultado === 'valido' ? 'XML consistente' : result.resultado === 'alerta' ? 'XML consistente com alertas' : 'XML inconsistente'}</strong><span>Regra {result.versaoRegra}</span></div>
                {result.inconsistencias.length > 0 && <ul>{result.inconsistencias.map((issue, index) => <li key={`${issue.campo}-${index}`}><b>{issue.campo}</b><span>{issue.mensagem}</span></li>)}</ul>}
              </div>
            )}
            <div className="rtc-mini-history">
              <h3>Últimas validações</h3>
              {(historyQuery.data?.validacoes || []).slice(0, 5).map((item) => <article key={item.id}><span className={`rtc-dot ${item.resultado}`} /><div><strong>{item.arquivoNome}</strong><small>{item.tipoDocumento.toUpperCase()} · {formatDate(item.criadoEm)}</small></div><b>{item.resultado}</b></article>)}
              {!historyQuery.isLoading && (historyQuery.data?.validacoes.length || 0) === 0 && <p>Nenhum XML registrado para este cliente.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
