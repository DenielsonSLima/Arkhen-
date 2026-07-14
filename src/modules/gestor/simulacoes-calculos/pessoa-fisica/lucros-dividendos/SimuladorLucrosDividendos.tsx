import React from 'react';
import { AlertTriangle, Calculator, CircleDollarSign, ShieldCheck } from 'lucide-react';
import { CurrencyInput } from '../../../shared/CurrencyInput';
import { formatCurrency } from '../../services/calculos.service';
import type { LucrosDividendosParams, ResultadoLucrosDividendos } from '../types';
import '../PessoaFisica.css';

interface Props {
  params: LucrosDividendosParams;
  setParams: (params: LucrosDividendosParams) => void;
  resultado: ResultadoLucrosDividendos | null;
}

export const SimuladorLucrosDividendos: React.FC<Props> = ({ params, setParams, resultado }) => {
  const update = <K extends keyof LucrosDividendosParams>(key: K, value: LucrosDividendosParams[K]) => {
    setParams({ ...params, [key]: value });
  };

  return (
    <div className="calc-layout">
      <div className="calc-form-card">
        <h3><CircleDollarSign size={18} color="#c59235" />Pró-labore, Lucros e Dividendos</h3>

        <section className="pf-form-section">
          <p className="pf-section-title">Cenário</p>
          <div className="pf-field-grid">
            <div className="calc-field">
              <label htmlFor="dividendos-competencia">Competência</label>
              <input id="dividendos-competencia" type="month" value={params.competencia} onChange={(event) => update('competencia', event.target.value)} />
            </div>
            <div className="calc-field">
              <label htmlFor="dividendos-regime">Regime tributário</label>
              <select id="dividendos-regime" value={params.regimeTributario} onChange={(event) => update('regimeTributario', event.target.value as LucrosDividendosParams['regimeTributario'])}>
                <option value="simples_anexo_iii">Simples Nacional — Anexos III ou V</option>
                <option value="simples_anexo_iv">Simples Nacional — Anexo IV</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
              </select>
            </div>
            {params.regimeTributario === 'simples_anexo_iv' && (
              <div className="calc-field">
                <label htmlFor="dividendos-cpp">CPP patronal estimada (%)</label>
                <input id="dividendos-cpp" type="number" min="0.01" max="100" step="0.01" required value={params.aliquotaCpp} onChange={(event) => update('aliquotaCpp', event.target.value)} />
                <small>No Anexo IV, a CPP é recolhida fora do DAS. Confirme a alíquota aplicável à folha.</small>
              </div>
            )}
          </div>
        </section>

        <section className="pf-form-section">
          <p className="pf-section-title">Remuneração e lucro comprovado</p>
          <div className="pf-field-grid">
            <CurrencyField label="Pró-labore atual" value={params.proLabore} onChange={(value) => update('proLabore', value)} />
            <CurrencyField label="Pró-labore alternativo" value={params.proLaboreAlternativo} onChange={(value) => update('proLaboreAlternativo', value)} />
            <CurrencyField label="Pró-labore acumulado no ano" value={params.proLaboreAcumuladoAno} onChange={(value) => update('proLaboreAcumuladoAno', value)} />
            <CurrencyField label="Lucro disponível comprovado" value={params.lucroDisponivelComprovado} onChange={(value) => update('lucroDisponivelComprovado', value)} />
            <label className="calc-check-row">
              <input type="checkbox" checked={params.lucroContabilComprovado} onChange={(event) => update('lucroContabilComprovado', event.target.checked)} />
              Há escrituração e demonstração contábil que comprovam o lucro informado
            </label>
            <div className="calc-field">
              <label htmlFor="dividendos-participacao">Participação societária (%)</label>
              <input id="dividendos-participacao" type="number" min="0" max="100" step="0.01" value={params.participacaoSocietaria} onChange={(event) => update('participacaoSocietaria', event.target.value)} />
            </div>
          </div>
        </section>

        <section className="pf-form-section">
          <p className="pf-section-title">Dividendos e outros rendimentos</p>
          <div className="pf-field-grid">
            <CurrencyField label="Dividendos previstos no mês" value={params.dividendosNoMes} onChange={(value) => update('dividendosNoMes', value)} />
            <CurrencyField label="Dividendos acumulados no ano" value={params.dividendosAcumuladosAno} onChange={(value) => update('dividendosAcumuladosAno', value)} />
            <CurrencyField label="Outros rendimentos no ano" value={params.outrosRendimentosAno} onChange={(value) => update('outrosRendimentosAno', value)} />
          </div>
        </section>

        <div className="pf-status-note"><ShieldCheck size={16} />A distribuição depende de lucro contábil regularmente apurado e comprovado.</div>
      </div>

      <div className="resultado-card" aria-live="polite">
        <h3><Calculator size={18} color="#c59235" />Resultado do cenário</h3>
        {!resultado ? (
          <div className="pf-status-note">Preencha os dados para consultar as regras vigentes no servidor.</div>
        ) : (
          <>
            <ResultRow label="Pró-labore bruto" value={resultado.proLaboreBruto} />
            <ResultRow label="INSS do sócio" value={resultado.inssSocio} danger />
            <ResultRow label="IRRF do pró-labore" value={resultado.irrfProLabore} danger />
            <ResultRow label="CPP da empresa" value={resultado.cppEmpresa} />
            <ResultRow label="Pró-labore líquido" value={resultado.proLaboreLiquido} success />

            <div className="pf-result-section">
              <h4>Distribuição</h4>
              <ResultRow label="Dividendos brutos" value={resultado.dividendosBrutos} />
              <ResultRow label="Retenção sobre dividendos" value={resultado.retencaoDividendos} danger />
              <ResultRow label="Dividendos líquidos" value={resultado.dividendosLiquidos} success />
              <ResultRow label="Líquido total do sócio" value={resultado.liquidoTotalSocio} highlight />
              <ResultRow label="Custo total da empresa" value={resultado.custoTotalEmpresa} />
              <ResultRow label="Rendimento anual acumulado" value={resultado.rendimentoAnualAcumulado} />
            </div>

            <div className={`pf-status-note ${resultado.distribuicaoPermitida ? 'success' : 'warning'}`}>
              {resultado.distribuicaoPermitida ? 'Distribuição compatível com o lucro comprovado informado.' : 'Distribuição não suportada pelo lucro comprovado informado.'}
            </div>
            {resultado.mensagemAltaRenda && (
              <div className={`pf-status-note ${resultado.alertaAltaRenda ? 'warning' : ''}`}><AlertTriangle size={16} />{resultado.mensagemAltaRenda}</div>
            )}
            {resultado.alertas.length > 0 && (
              <div className="pf-result-section"><h4>Alertas</h4><ul className="pf-alert-list">{resultado.alertas.map((item) => <li key={item}>{item}</li>)}</ul></div>
            )}
            <p className="pf-version">Parâmetros: {resultado.versaoParametros}</p>
          </>
        )}
      </div>
    </div>
  );
};

const ResultRow = ({ label, value, danger = false, success = false, highlight = false }: { label: string; value: number; danger?: boolean; success?: boolean; highlight?: boolean }) => (
  <div className={`resultado-row${danger ? ' perigo' : ''}${success ? ' verde' : ''}${highlight ? ' destaque' : ''}`}>
    <span className="r-label">{label}</span><span className="r-valor">{formatCurrency(value)}</span>
  </div>
);

const CurrencyField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
  const id = React.useId();
  return <div className="calc-field"><label htmlFor={id}>{label}</label><CurrencyInput id={id} value={value} onValueChange={onChange} /></div>;
};
