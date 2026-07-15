import { useState } from 'react';
import { Landmark, WalletCards } from 'lucide-react';
import { useSplitSimulationMutation } from '../hooks/useReformaTributariaQueries';
import { formatCurrency } from '../services/reformaPresentation';

const initialValues = {
  competencia: '2027-01-01', receitaPix: '', receitaCartao: '', receitaBoleto: '',
  receitaOutros: '', aliquotaEfetiva: '', percentualCobertura: '100',
};
const resultObject = (value: unknown) => (value && typeof value === 'object' ? value as Record<string, unknown> : {});

export const SplitPaymentForm = ({ clienteId }: { clienteId: string }) => {
  const [values, setValues] = useState(initialValues);
  const mutation = useSplitSimulationMutation();
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const result = resultObject(mutation.data?.resultado);

  return (
    <div className="rtc-simulator-layout">
      <form className="rtc-panel rtc-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ clienteId, values }); }}>
        <header className="rtc-panel-header"><div><span className="rtc-eyebrow">Projeção financeira</span><h2>Receitas por meio de pagamento</h2></div><WalletCards size={22} /></header>
        <div className="rtc-form-grid">
          <label><span>Competência</span><input type="date" value={values.competencia} onChange={(event) => set('competencia', event.target.value)} required /></label>
          <label><span>Receitas via Pix (R$)</span><input type="number" min="0" step="0.01" value={values.receitaPix} onChange={(event) => set('receitaPix', event.target.value)} /></label>
          <label><span>Receitas via cartão (R$)</span><input type="number" min="0" step="0.01" value={values.receitaCartao} onChange={(event) => set('receitaCartao', event.target.value)} /></label>
          <label><span>Receitas via boleto (R$)</span><input type="number" min="0" step="0.01" value={values.receitaBoleto} onChange={(event) => set('receitaBoleto', event.target.value)} /></label>
          <label><span>Outros recebimentos (R$)</span><input type="number" min="0" step="0.01" value={values.receitaOutros} onChange={(event) => set('receitaOutros', event.target.value)} /></label>
          <label><span>Alíquota efetiva estimada (%)</span><input type="number" min="0" max="100" step="0.0001" value={values.aliquotaEfetiva} onChange={(event) => set('aliquotaEfetiva', event.target.value)} required /></label>
          <label><span>Cobertura estimada do split (%)</span><input type="number" min="0" max="100" step="0.01" value={values.percentualCobertura} onChange={(event) => set('percentualCobertura', event.target.value)} required /></label>
        </div>
        {mutation.error && <div className="rtc-form-error">{mutation.error.message}</div>}
        <button className="rtc-primary-button" type="submit" disabled={mutation.isPending}><Landmark size={16} />{mutation.isPending ? 'Projetando no backend...' : 'Projetar impacto no caixa'}</button>
      </form>
      <section className="rtc-panel rtc-result-panel">
        <header className="rtc-panel-header"><div><span className="rtc-eyebrow">Liquidez projetada</span><h2>Impacto do split payment</h2></div></header>
        {!mutation.data ? <div className="rtc-result-placeholder"><WalletCards size={32} /><strong>Preencha os recebimentos</strong><span>A projeção será registrada para comparação futura.</span></div> : <>
          <div className="rtc-cash-waterfall">
            <article><span>Receita total</span><strong>{formatCurrency(result.receitaTotal)}</strong></article>
            <article className="negative"><span>Segregação estimada</span><strong>- {formatCurrency(result.valorSegregadoEstimado)}</strong></article>
            <article className="positive"><span>Caixa disponível</span><strong>{formatCurrency(result.caixaDisponivelEstimado)}</strong></article>
          </div>
          <div className="rtc-capital-grid"><span>Capital de giro · 30 dias<strong>{formatCurrency(result.necessidadeCapitalGiro30Dias)}</strong></span><span>Capital de giro · 90 dias<strong>{formatCurrency(result.necessidadeCapitalGiro90Dias)}</strong></span></div>
          <p className="rtc-result-notice">{String(result.aviso || '')}</p>
        </>}
      </section>
    </div>
  );
};
