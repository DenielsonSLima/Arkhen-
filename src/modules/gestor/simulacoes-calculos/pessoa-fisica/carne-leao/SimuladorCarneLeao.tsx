import React from 'react';
import { AlertTriangle, BookOpen, Calculator, ReceiptText } from 'lucide-react';
import { CurrencyInput } from '../../../shared/CurrencyInput';
import { CompetenciaSelect } from '../../../shared/CompetenciaSelect';
import { formatDateBr } from '../../../shared/dateDisplay';
import { formatCurrency, formatPercent } from '../../services/calculos.service';
import type { CarneLeaoParams, ResultadoCarneLeao } from '../types';
import '../PessoaFisica.css';

interface Props {
  params: CarneLeaoParams;
  setParams: (params: CarneLeaoParams) => void;
  resultado: ResultadoCarneLeao | null;
}

export const SimuladorCarneLeao: React.FC<Props> = ({ params, setParams, resultado }) => {
  const update = <K extends keyof CarneLeaoParams>(key: K, value: CarneLeaoParams[K]) => {
    setParams({ ...params, [key]: value });
  };

  return (
    <div className="calc-layout">
      <div className="calc-form-card">
        <h3><ReceiptText size={18} color="#c59235" />Carnê-Leão e Livro Caixa</h3>

        <section className="pf-form-section">
          <p className="pf-section-title">Competência e atividade</p>
          <div className="pf-field-grid">
            <CompetenciaSelect id="carne-competencia" value={params.competencia} onChange={(value) => update('competencia', value)} />
            <div className="calc-field">
              <label htmlFor="carne-atividade">Tipo de atividade</label>
              <select id="carne-atividade" value={params.tipoAtividade} onChange={(event) => update('tipoAtividade', event.target.value)}>
                <option value="autonomo">Trabalho autônomo</option>
                <option value="aluguel">Aluguel</option>
                <option value="exterior">Rendimento do exterior</option>
                <option value="outro">Outro rendimento sujeito</option>
              </select>
            </div>
          </div>
        </section>

        <section className="pf-form-section">
          <p className="pf-section-title">Rendimentos recebidos</p>
          <div className="pf-field-grid">
            <CurrencyField label="De pessoa física" value={params.rendimentosPessoaFisica} onChange={(value) => update('rendimentosPessoaFisica', value)} />
            <CurrencyField label="Do exterior" value={params.rendimentosExterior} onChange={(value) => update('rendimentosExterior', value)} />
            <CurrencyField label="Aluguéis" value={params.alugueis} onChange={(value) => update('alugueis', value)} />
            <CurrencyField label="Imposto pago no exterior" value={params.impostoPagoExterior} onChange={(value) => update('impostoPagoExterior', value)} />
          </div>
        </section>

        <section className="pf-form-section">
          <p className="pf-section-title">Deduções informadas</p>
          <div className="pf-field-grid">
            <CurrencyField label="Previdência oficial" value={params.previdenciaOficial} onChange={(value) => update('previdenciaOficial', value)} />
            <div className="calc-field">
              <label htmlFor="carne-dependentes">Quantidade de dependentes</label>
              <input id="carne-dependentes" type="number" min="0" step="1" value={params.quantidadeDependentes} onChange={(event) => update('quantidadeDependentes', event.target.value)} />
            </div>
            <CurrencyField label="Pensão alimentícia" value={params.pensaoAlimenticia} onChange={(value) => update('pensaoAlimenticia', value)} />
            <CurrencyField label="Despesas do Livro Caixa" value={params.despesasLivroCaixa} onChange={(value) => update('despesasLivroCaixa', value)} />
            <CurrencyField label="Excesso do Livro Caixa anterior" value={params.excessoLivroCaixaAnterior} onChange={(value) => update('excessoLivroCaixaAnterior', value)} />
          </div>
        </section>
      </div>

      <div className="resultado-card" aria-live="polite">
        <h3><Calculator size={18} color="#c59235" />Estimativa mensal</h3>
        {!resultado ? (
          <div className="pf-status-note"><BookOpen size={16} />Preencha os dados para consultar a regra vigente no servidor.</div>
        ) : (
          <>
            <ResultRow label="Rendimentos tributáveis" value={resultado.rendimentosTributaveis} />
            <ResultRow label="Deduções admitidas" value={resultado.deducoesAdmitidas} tone="verde" />
            <ResultRow label="Base de cálculo" value={resultado.baseCalculo} />
            <ResultRow label="Imposto pela tabela" value={resultado.impostoTabela} />
            <ResultRow label="Redução aplicada" value={resultado.reducaoAplicada} tone="verde" />
            <ResultRow label="DARF estimado" value={resultado.impostoDevido} highlight />

            <div className="pf-result-section">
              <h4>Recolhimento</h4>
              <div className="resultado-row"><span className="r-label">Código de receita</span><span className="r-valor">{resultado.codigoReceita}</span></div>
              <div className="resultado-row"><span className="r-label">Vencimento</span><span className="r-valor">{formatDateBr(resultado.vencimento)}</span></div>
              <ResultRow label="Excesso de Livro Caixa" value={resultado.excessoLivroCaixa} />
            </div>

            <Memory items={resultado.memoriaCalculo} />
            <Alerts items={resultado.alertas} />
            <p className="pf-version">Parâmetros: {resultado.versaoParametros}</p>
          </>
        )}
      </div>
    </div>
  );
};

const CurrencyField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
  const id = React.useId();
  return <div className="calc-field"><label htmlFor={id}>{label}</label><CurrencyInput id={id} value={value} onValueChange={onChange} /></div>;
};

const ResultRow = ({ label, value, tone, highlight = false }: { label: string; value: number; tone?: 'verde'; highlight?: boolean }) => (
  <div className={`resultado-row${highlight ? ' destaque' : ''}${tone ? ` ${tone}` : ''}`}>
    <span className="r-label">{label}</span><span className="r-valor">{formatCurrency(value)}</span>
  </div>
);

const Memory = ({ items }: { items: ResultadoCarneLeao['memoriaCalculo'] }) => items.length > 0 ? (
  <div className="pf-result-section"><h4>Memória de cálculo</h4><ul className="pf-memory-list">
    {items.map((item, index) => <li className="pf-memory-line" key={`${item.descricao}-${index}`}><span>{item.descricao}{item.aliquota == null ? '' : ` (${formatPercent(item.aliquota)})`}</span><strong>{formatCurrency(item.valor)}</strong></li>)}
  </ul></div>
) : null;

const Alerts = ({ items }: { items: string[] }) => items.length > 0 ? (
  <div className="pf-result-section"><h4>Alertas</h4><ul className="pf-alert-list">{items.map((item) => <li key={item}><AlertTriangle size={13} /> {item}</li>)}</ul></div>
) : null;
