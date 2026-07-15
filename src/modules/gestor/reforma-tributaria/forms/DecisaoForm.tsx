import { useState } from 'react';
import { Save } from 'lucide-react';
import { useSaveDecisaoMutation } from '../hooks/useReformaTributariaQueries';
import type { ReformaSimulacaoHistorico } from '../services/reformaTributaria.types';

export const DecisaoForm = ({ clienteId, simulacoes }: { clienteId: string; simulacoes: ReformaSimulacaoHistorico[] }) => {
  const mutation = useSaveDecisaoMutation();
  const [values, setValues] = useState<Record<string, string | null>>({
    decisao: 'pendente', simulacaoId: null, parecer: '', cienciaClienteEm: null,
    periodoInicio: '2027-01-01', periodoFim: '2027-06-30',
  });
  const set = (key: string, value: string | null) => setValues((current) => ({ ...current, [key]: value }));
  return (
    <form className="rtc-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ clienteId, values }); }}>
      <div className="rtc-form-grid">
        <label><span>Decisão registrada</span><select value={values.decisao || 'pendente'} onChange={(event) => set('decisao', event.target.value)}><option value="pendente">Pendente</option><option value="manter_simples">Manter IBS/CBS no Simples</option><option value="regime_regular">Optar pelo regime regular</option><option value="inconclusivo">Inconclusivo</option></select></label>
        <label><span>Simulação de referência</span><select value={values.simulacaoId || ''} onChange={(event) => set('simulacaoId', event.target.value || null)}><option value="">Sem vínculo</option>{simulacoes.filter((item) => item.tipo === 'ibs_cbs').map((item) => <option value={item.id} key={item.id}>{new Date(item.criadoEm).toLocaleString('pt-BR')}</option>)}</select></label>
        <label><span>Ciência do cliente</span><input type="datetime-local" value={values.cienciaClienteEm || ''} onChange={(event) => set('cienciaClienteEm', event.target.value || null)} /></label>
        <label><span>Início do período</span><input type="date" value={values.periodoInicio || ''} onChange={(event) => set('periodoInicio', event.target.value)} /></label>
        <label><span>Fim do período</span><input type="date" value={values.periodoFim || ''} onChange={(event) => set('periodoFim', event.target.value)} /></label>
      </div>
      <label className="rtc-form-full"><span>Parecer e premissas</span><textarea rows={5} maxLength={10000} value={values.parecer || ''} onChange={(event) => set('parecer', event.target.value)} placeholder="Registre análise, premissas, riscos e recomendação profissional." /></label>
      {mutation.error && <div className="rtc-form-error">{mutation.error.message}</div>}
      {mutation.isSuccess && <div className="rtc-form-success">Decisão registrada no histórico.</div>}
      <button className="rtc-primary-button" type="submit" disabled={mutation.isPending}><Save size={16} />{mutation.isPending ? 'Registrando...' : 'Registrar decisão'}</button>
    </form>
  );
};
