import { useState } from 'react';
import { Calculator, ShieldAlert } from 'lucide-react';
import { useIbsCbsSimulationMutation } from '../hooks/useReformaTributariaQueries';
import { formatCurrency } from '../services/reformaPresentation';

const initialValues = {
  competencia: '2027-01-01', receitaMensal: '', aliquotaSimples: '', aliquotaRegular: '',
  comprasCreditaveis: '', aliquotaCredito: '', percentualB2b: '',
};

const resultObject = (value: unknown) => (value && typeof value === 'object' ? value as Record<string, unknown> : {});

export const SimulacaoIbsCbsForm = ({ clienteId }: { clienteId: string }) => {
  const [values, setValues] = useState(initialValues);
  const mutation = useIbsCbsSimulationMutation();
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const result = resultObject(mutation.data?.resultado);
  const simples = resultObject(result.cenarioDentroSimples);
  const regular = resultObject(result.cenarioRegimeRegular);

  return (
    <div className="rtc-simulator-layout">
      <form className="rtc-panel rtc-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ clienteId, values }); }}>
        <header className="rtc-panel-header"><div><span className="rtc-eyebrow">Premissas editáveis</span><h2>Cenário mensal</h2></div><Calculator size={22} /></header>
        <div className="rtc-form-grid">
          <label><span>Competência</span><input type="date" value={values.competencia} onChange={(event) => set('competencia', event.target.value)} required /></label>
          <label><span>Receita mensal (R$)</span><input type="number" min="0" step="0.01" value={values.receitaMensal} onChange={(event) => set('receitaMensal', event.target.value)} required /></label>
          <label><span>IBS/CBS dentro do Simples (%)</span><input type="number" min="0" max="100" step="0.0001" value={values.aliquotaSimples} onChange={(event) => set('aliquotaSimples', event.target.value)} required /></label>
          <label><span>Alíquota regular estimada (%)</span><input type="number" min="0" max="100" step="0.0001" value={values.aliquotaRegular} onChange={(event) => set('aliquotaRegular', event.target.value)} required /></label>
          <label><span>Compras creditáveis (R$)</span><input type="number" min="0" step="0.01" value={values.comprasCreditaveis} onChange={(event) => set('comprasCreditaveis', event.target.value)} required /></label>
          <label><span>Alíquota média dos créditos (%)</span><input type="number" min="0" max="100" step="0.0001" value={values.aliquotaCredito} onChange={(event) => set('aliquotaCredito', event.target.value)} required /></label>
          <label><span>Vendas B2B (%)</span><input type="number" min="0" max="100" step="0.01" value={values.percentualB2b} onChange={(event) => set('percentualB2b', event.target.value)} required /></label>
        </div>
        <div className="rtc-inline-warning"><ShieldAlert size={17} />As alíquotas são premissas do contador e ficam registradas com o resultado.</div>
        {mutation.error && <div className="rtc-form-error">{mutation.error.message}</div>}
        <button className="rtc-primary-button" type="submit" disabled={mutation.isPending}><Calculator size={16} />{mutation.isPending ? 'Calculando no backend...' : 'Gerar cenário'}</button>
      </form>

      <section className="rtc-panel rtc-result-panel">
        <header className="rtc-panel-header"><div><span className="rtc-eyebrow">Comparação retornada</span><h2>Dentro x fora do Simples</h2></div></header>
        {!mutation.data ? <div className="rtc-result-placeholder"><Calculator size={32} /><strong>Informe as premissas</strong><span>O frontend não realiza cálculos tributários.</span></div> : <>
          <div className="rtc-scenario-cards">
            <article><small>Dentro do Simples</small><strong>{formatCurrency(simples.valorMensal)}</strong><span>Mensal · {formatCurrency(simples.valorSemestral)} no semestre</span></article>
            <article><small>Regime regular</small><strong>{formatCurrency(regular.saldoMensal)}</strong><span>Débito {formatCurrency(regular.debitoMensal)} · créditos {formatCurrency(regular.creditosMensais)}</span></article>
          </div>
          <div className="rtc-result-difference"><span>Diferença mensal estimada</span><strong>{formatCurrency(result.diferencaMensal)}</strong><small>{String(result.tendencia || '').replaceAll('_', ' ')}</small></div>
          <p className="rtc-result-notice">{String(result.aviso || '')}</p>
        </>}
      </section>
    </div>
  );
};
