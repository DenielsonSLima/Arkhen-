import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFaturamentoClientesQuery } from '../../queries/useFaturamentoQueries';
import { useFiscalBillingTenant, useFiscalDraftMutations, useFiscalEmitters } from '../../queries/useFaturamentoFiscalQueries';
import type { FiscalAmbiente, FiscalDraft, FiscalDraftData, FiscalReview } from '../../services/faturamentoFiscalTypes';
import { blankFiscalData, editableFiscalData } from './fiscalFormData';
import { FiscalDataFields } from './FiscalDataFields';
import { FiscalReviewPanel } from './FiscalReviewPanel';
import { PreviousFiscalNotes } from './PreviousFiscalNotes';
import './NfseDraft.css';

interface Props { onClose: () => void; onBack?: () => void; initial?: FiscalDraft; cobrancaId?: string; clienteId?: string; valor?: number; descricao?: string }
export function NfseDraftForm({ onClose, onBack, initial, cobrancaId, clienteId: initialClient, valor, descricao }: Props) {
  const tenant = useFiscalBillingTenant();
  const emitters = useFiscalEmitters(tenant.data || '');
  const clients = useFaturamentoClientesQuery(true);
  const mutations = useFiscalDraftMutations();
  const [fiscalConfigId, setConfigId] = useState(initial?.fiscalConfigId || '');
  const [ambiente, setAmbiente] = useState<FiscalAmbiente>(initial?.ambiente || 'homologacao');
  const [clienteId, setClient] = useState(initial?.clienteId || initialClient || '');
  const [draftId, setDraftId] = useState(initial?.id);
  const [data, setData] = useState<FiscalDraftData>(() => initial ? editableFiscalData(initial.dados)
    : { ...blankFiscalData(), valor: valor ?? '', descricao: descricao || '' });
  const [review, setReview] = useState<FiscalReview>();
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [transmitted, setTransmitted] = useState(false);
  const [previousBusy, setPreviousBusy] = useState(false);
  const [period, setPeriod] = useState(() => {
    const today = new Date(); const year = today.getFullYear();
    return { inicio: `${year}-01-01`, fim: `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` };
  });
  const busy = mutations.save.isPending || mutations.review.isPending || mutations.emit.isPending;
  const immutable = transmitted || (initial && (!['rascunho', 'falha_pre_envio'].includes(initial.status)
    || Boolean(initial.origem && initial.origem !== 'rascunho')));
  const emitter = (emitters.data || []).find(item => item.id === fiscalConfigId);
  const scope = { fiscalConfigId, clienteId, ambiente, dataInicial: period.inicio, dataFinal: period.fim };
  const clearReview = () => { setReview(undefined); setConfirmed(false); setMessage(''); setError(''); };
  const changeContext = () => { setDraftId(undefined); setData({ ...blankFiscalData(), valor: valor ?? '', descricao: descricao || '' }); clearReview(); };
  const save = async (withReview: boolean) => {
    clearReview();
    if (!fiscalConfigId || !clienteId) { setError('Selecione o emitente e o parceiro/tomador.'); return; }
    try {
      const saved = await mutations.save.mutateAsync({ id: draftId, fiscalConfigId, clienteId,
        cobrancaId: initial?.cobrancaId || cobrancaId, ambiente, dados: data });
      setDraftId(saved.id);
      if (withReview) setReview(await mutations.review.mutateAsync(saved.id));
      setMessage(withReview ? 'Rascunho salvo e revisado. Nenhuma nota foi transmitida.' : 'Rascunho salvo. Nenhuma nota foi transmitida.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o rascunho.'); }
  };
  const emit = async () => {
    if (!review?.ready || review.blockers.length || !confirmed || ambiente !== 'homologacao') return;
    setError('');
    try {
      const result = await mutations.emit.mutateAsync(review.rascunho);
      setMessage(`NFS-e ${result.nfseId} confirmada em ${result.ambiente}. Consulte o histórico para baixar PDF/XML.`);
      setTransmitted(true);
      setReview(undefined); setConfirmed(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Emissão não confirmada. Consulte o mesmo RPS no histórico.'); setReview(undefined); }
  };
  return createPortal(<div className="faturamento-modal-backdrop"><div className="faturamento-card nfse-draft-modal" role="dialog" aria-modal="true" aria-label="Preparar NFS-e">
    <header className="faturamento-modal-header"><div><h2>Preparar NFS-e</h2><p>{cobrancaId ? 'Cobrança criada. Prepare e revise a nota vinculada.' : 'Rascunho fiscal independente, sem geração de boleto ou Pix.'}</p></div>
      <button type="button" className="faturamento-modal-close" aria-label="Fechar" disabled={busy} onClick={onClose}><X size={20} /></button></header>
    <div className="nfse-draft-body">
      {(tenant.isError || emitters.isError || clients.isError) && <p role="alert">Não foi possível carregar empresa, emitentes ou parceiros. Tente abrir novamente.</p>}
      <fieldset disabled={busy || !!immutable} className="nfse-fields"><legend>Emitente, ambiente e tomador</legend>
        <label className="faturamento-form-group"><span>Ambiente</span><select value={ambiente} onChange={e => { setAmbiente(e.target.value as FiscalAmbiente); setConfigId(''); changeContext(); }}>
          <option value="homologacao">Homologação (teste sem valor fiscal)</option><option value="producao">Produção (somente preparação)</option></select></label>
        <label className="faturamento-form-group"><span>Emitente / configuração fiscal</span><select value={fiscalConfigId} onChange={e => { setConfigId(e.target.value); changeContext(); }}>
          <option value="">Selecione um emitente cadastrado</option>{(emitters.data || []).map(item => <option value={item.id} key={item.id}>
            {item.prestadorNome} · {item.prestadorCnpj}{item.ativo ? '' : ' (inativo)'}</option>)}</select></label>
        <label className="faturamento-form-group nfse-full"><span>Parceiro / tomador</span><select value={clienteId} disabled={!!cobrancaId} onChange={e => { setClient(e.target.value); changeContext(); }}>
          <option value="">Selecione o tomador</option>{(clients.data || []).map(client => <option value={client.id} key={client.id}>{client.razaoSocial || client.nome} · {client.cnpj}</option>)}</select></label>
        {emitter && <p className="nfse-full">CNPJ do emitente: {emitter.prestadorCnpj} · IM: {emitter.inscricaoMunicipal || 'não informada'} · Itabaiana / SE · Ambiente desta operação: {ambiente}. Padrão salvo: {emitter.ambiente}.{!emitter.ativo && ' Contexto inativo para emissão; consulta de notas disponível.'}</p>}
      </fieldset>
      {!emitters.isLoading && !emitters.isError && tenant.data && !emitters.data?.length && <p role="alert">Nenhum emitente WebISS configurado. Cadastre a integração fiscal em Configurações.</p>}
      {!immutable && fiscalConfigId && clienteId && <>
        <div className="nfse-fields"><label className="faturamento-form-group"><span>Histórico de emissão — início</span><input type="date" value={period.inicio} onChange={e => setPeriod({ ...period, inicio: e.target.value })} /></label>
          <label className="faturamento-form-group"><span>Histórico de emissão — fim</span><input type="date" value={period.fim} onChange={e => setPeriod({ ...period, fim: e.target.value })} /></label></div>
        <PreviousFiscalNotes key={JSON.stringify(scope)} tenant={tenant.data || ''} scope={scope} competencia={data.competencia} disabled={busy} onBusyChange={setPreviousBusy} onCopy={copied => {
          setDraftId(copied.id); setData(editableFiscalData(copied.dados)); clearReview(); setMessage('Dados copiados para outro rascunho. Revise competência, valor e descrição.');
        }} />
      </>}
      <FiscalDataFields data={data} disabled={busy || !!immutable} onChange={next => { setData(next); clearReview(); }} />
      {immutable && <p>Esta tentativa já possui processamento fiscal. Consulte o mesmo RPS no histórico; não reenvie como outro rascunho.</p>}
      {review && <FiscalReviewPanel review={review} />}
      {error && <p className="faturamento-error-message" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      {review && ambiente === 'homologacao' && review.ready && !review.blockers.length && <label className="nfse-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Conferi os dados e quero transmitir esta nota em homologação.</label>}
      {ambiente === 'producao' && <p>Transmissão de produção não liberada nesta etapa.</p>}
    </div>
    <footer className="faturamento-modal-actions">{onBack && <button type="button" className="faturamento-btn-secondary" disabled={busy} onClick={onBack}>Voltar</button>}
      {!immutable && <><button type="button" className="faturamento-btn-secondary" disabled={busy || previousBusy} onClick={() => void save(false)}>Salvar rascunho</button>
        <button type="button" className="faturamento-btn-primary" disabled={busy || previousBusy} onClick={() => void save(true)}>{busy ? 'Processando...' : 'Salvar e revisar'}</button></>}
      {review && <button type="button" className="faturamento-btn-primary" disabled={busy || previousBusy || !confirmed || !review.ready || !!review.blockers.length || ambiente !== 'homologacao'} onClick={() => void emit()}>Transmitir em homologação</button>}
    </footer>
  </div></div>, document.body);
}
