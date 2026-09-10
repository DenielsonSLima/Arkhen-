import { useState } from 'react';
import { useRecorrenciaConfig, useRecorrenciaMutations } from '../queries/useRecorrenciaQueries';
import type { RecorrenciaConfig, RecorrenciaInput } from '../services/recorrenciaService';
import { RecorrenciaScheduleFields } from './RecorrenciaScheduleFields';

const defaults: RecorrenciaConfig = {
  meioPagamento: 'Ambos', descontoPercentual: 0, jurosPercentual: 0, multaPercentual: 0, mensagemBoleto: '',
  diaProcessamento: 1, primeiraCompetencia: '', competenciaOffset: 0, modoFiscal: 'rascunho',
  ambiente: 'homologacao', fiscalConfigId: '', dadosFiscais: {},
};
function Editor({ initial }: { initial: RecorrenciaInput }) {
  const [data, setData] = useState<RecorrenciaInput>({ ...initial, gerarPrimeiraCobranca: false,
    recorrenciaConfig: { ...defaults, ...initial.recorrenciaConfig } });
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const mutations = useRecorrenciaMutations();
  const config = data.recorrenciaConfig;
  const update = (patch: Partial<RecorrenciaConfig>) => setData({ ...data, recorrenciaConfig: { ...config, ...patch } });
  const save = async () => {
    setError(''); setMessage('');
    try {
      await mutations.save.mutateAsync(data);
      setMessage(data.recorrenciaAtiva ? 'Agendamento salvo. As próximas competências seguirão esta configuração.' : 'Configuração salva. O agendamento mensal está pausado.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); }
  };
  return <div className="faturamento-card">
    <h3>Condições da recorrência</h3>
    <p>Alterações valem para competências ainda não geradas. Execuções já criadas preservam os dados originais.</p>
    <fieldset disabled={mutations.save.isPending} style={{ border: 0, padding: 0 }}>
      <div className="nfse-fields">
        <label className="faturamento-form-group"><span>Valor mensal (R$)</span><input type="number" min="0.01" step="0.01" value={data.valorMensal} onChange={e => setData({ ...data, valorMensal: Number(e.target.value) })} /></label>
        <label className="faturamento-form-group"><span>Dia de vencimento</span><select value={data.diaVencimento} onChange={e => setData({ ...data, diaVencimento: Number(e.target.value) })}>
          {Array.from({ length: 28 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select></label>
        <label className="faturamento-form-group nfse-full"><span>Descrição</span><textarea maxLength={2000} value={data.descricaoServico} onChange={e => setData({ ...data, descricaoServico: e.target.value })} /></label>
        <label className="faturamento-form-group"><span>Forma de pagamento</span><select value={config.meioPagamento} onChange={e => update({ meioPagamento: e.target.value as RecorrenciaConfig['meioPagamento'] })}>
          <option value="Ambos">Boleto + Pix</option><option value="Pix">Pix</option><option value="Boleto">Boleto</option></select></label>
        {(['descontoPercentual', 'jurosPercentual', 'multaPercentual'] as const).map((key, index) => <label key={key} className="faturamento-form-group"><span>{['Desconto (%)', 'Juros ao mês (%)', 'Multa (%)'][index]}</span>
          <input type="number" min="0" max="100" step="0.01" value={config[key]} onChange={e => update({ [key]: Number(e.target.value) })} /></label>)}
        <label className="faturamento-form-group nfse-full"><span>Mensagem do boleto</span><textarea maxLength={220} value={config.mensagemBoleto} onChange={e => update({ mensagemBoleto: e.target.value })} /></label>
      </div>
      <RecorrenciaScheduleFields config={config} onChange={recorrenciaConfig => setData({ ...data, recorrenciaConfig })}
        active={data.recorrenciaAtiva} onActiveChange={recorrenciaAtiva => setData({ ...data, recorrenciaAtiva })} />
    </fieldset>
    {error && <p role="alert" className="faturamento-error-message">{error}</p>}{message && <p role="status">{message}</p>}
    <div className="faturamento-modal-actions"><button className="faturamento-btn-primary" disabled={mutations.save.isPending} onClick={() => void save()}>{mutations.save.isPending ? 'Salvando...' : 'Salvar configuração'}</button></div>
  </div>;
}
export function RecorrenciaConfigForm({ contratoId }: { contratoId: string }) {
  const query = useRecorrenciaConfig(contratoId);
  if (query.isLoading) return <p>Carregando configuração...</p>;
  if (query.isError || !query.data) return <p role="alert">Não foi possível carregar a configuração. <button onClick={() => void query.refetch()}>Tentar novamente</button></p>;
  return <Editor key={contratoId} initial={query.data} />;
}
