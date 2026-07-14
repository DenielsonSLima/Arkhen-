import React from 'react';
import { AlertTriangle, Calculator, ClipboardCheck, Landmark } from 'lucide-react';
import { CurrencyInput } from '../../../shared/CurrencyInput';
import { formatCurrency } from '../../services/calculos.service';
import type { IrpfParams, ResultadoIrpf, ResultadoModeloIrpf } from '../types';
import '../PessoaFisica.css';

interface Props {
  params: IrpfParams;
  setParams: (params: IrpfParams) => void;
  resultado: ResultadoIrpf | null;
}

export const SimuladorIrpf: React.FC<Props> = ({ params, setParams, resultado }) => {
  const update = <K extends keyof IrpfParams>(key: K, value: IrpfParams[K]) => {
    setParams({ ...params, [key]: value });
  };

  return (
    <div className="calc-layout">
      <div className="calc-form-card">
        <h3><Landmark size={18} color="#c59235" />Projeção de IRPF</h3>

        <section className="pf-form-section">
          <p className="pf-section-title">Período da projeção</p>
          <div className="pf-field-grid">
            <TextField label="Ano-calendário" type="number" value={params.anoCalendario} onChange={(value) => update('anoCalendario', value)} />
          </div>
          <div className="pf-status-note">O exercício é definido automaticamente como o ano seguinte ao ano-calendário.</div>
        </section>

        <section className="pf-form-section">
          <p className="pf-section-title">Rendimentos</p>
          <div className="pf-field-grid">
            <CurrencyField label="Tributáveis" value={params.rendimentosTributaveis} onChange={(value) => update('rendimentosTributaveis', value)} />
            <CurrencyField label="Isentos" value={params.rendimentosIsentos} onChange={(value) => update('rendimentosIsentos', value)} />
            <CurrencyField label="Tributação exclusiva" value={params.rendimentosExclusivos} onChange={(value) => update('rendimentosExclusivos', value)} />
          </div>
          <div className="pf-status-note">Lucros, dividendos e ganhos de capital são informados em suas simulações próprias e não alteram o imposto progressivo desta projeção.</div>
        </section>

        <section className="pf-form-section">
          <p className="pf-section-title">Deduções</p>
          <div className="pf-field-grid">
            <CurrencyField label="Previdência oficial" value={params.previdenciaOficial} onChange={(value) => update('previdenciaOficial', value)} />
            <TextField label="Quantidade de dependentes" type="number" value={params.quantidadeDependentes} onChange={(value) => update('quantidadeDependentes', value)} />
            <CurrencyField label="Saúde" value={params.despesasSaude} onChange={(value) => update('despesasSaude', value)} />
            <CurrencyField label="Educação" value={params.despesasEducacao} onChange={(value) => update('despesasEducacao', value)} />
            <CurrencyField label="Pensão alimentícia" value={params.pensaoAlimenticia} onChange={(value) => update('pensaoAlimenticia', value)} />
            <CurrencyField label="PGBL" value={params.pgbl} onChange={(value) => update('pgbl', value)} />
            <CurrencyField label="Livro Caixa" value={params.livroCaixa} onChange={(value) => update('livroCaixa', value)} />
          </div>
        </section>

        <section className="pf-form-section">
          <p className="pf-section-title">Impostos já pagos</p>
          <div className="pf-field-grid">
            <CurrencyField label="IRRF" value={params.irrfPago} onChange={(value) => update('irrfPago', value)} />
            <CurrencyField label="Carnê-Leão" value={params.carneLeaoPago} onChange={(value) => update('carneLeaoPago', value)} />
            <CurrencyField label="Imposto complementar" value={params.impostoComplementarPago} onChange={(value) => update('impostoComplementarPago', value)} />
            <CurrencyField label="Imposto no exterior" value={params.impostoPagoExterior} onChange={(value) => update('impostoPagoExterior', value)} />
            <CurrencyField label="Ganho de capital" value={params.ganhoCapitalPago} onChange={(value) => update('ganhoCapitalPago', value)} />
          </div>
        </section>
      </div>

      <div className="resultado-card" aria-live="polite">
        <h3><Calculator size={18} color="#c59235" />Comparação dos modelos</h3>
        {!resultado ? (
          <div className="pf-status-note"><ClipboardCheck size={16} />Informe os valores para comparar os modelos no servidor.</div>
        ) : (
          <>
            <ModelResult modelo={resultado.modeloLegal} recommended={resultado.modeloRecomendado === resultado.modeloLegal.nome} />
            <ModelResult modelo={resultado.modeloSimplificado} recommended={resultado.modeloRecomendado === resultado.modeloSimplificado.nome} />

            <div className="resultado-row destaque">
              <span className="r-label">Modelo recomendado</span>
              <span className="r-valor">{resultado.modeloRecomendado}</span>
            </div>

            {resultado.pendenciasDocumentais.length > 0 && (
              <div className="pf-result-section">
                <h4>Pendências documentais</h4>
                <ul className="pf-memory-list">{resultado.pendenciasDocumentais.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            )}
            {resultado.alertas.length > 0 && (
              <div className="pf-result-section">
                <h4>Alertas</h4>
                <ul className="pf-alert-list">{resultado.alertas.map((item) => <li key={item}><AlertTriangle size={13} /> {item}</li>)}</ul>
              </div>
            )}
            <p className="pf-version">Ano-calendário {resultado.anoCalendario} · Exercício {resultado.exercicio} · Parâmetros: {resultado.versaoParametros}</p>
          </>
        )}
      </div>
    </div>
  );
};

const ModelResult = ({ modelo, recommended }: { modelo: ResultadoModeloIrpf; recommended: boolean }) => (
  <section className={`pf-model-card${recommended ? ' recommended' : ''}`}>
    <div className="pf-model-title"><span>{modelo.nome}</span>{recommended && <span className="pf-model-badge">Mais econômico</span>}</div>
    <ResultRow label="Deduções consideradas" value={modelo.totalDeducoes} />
    <ResultRow label="Base de cálculo" value={modelo.baseCalculo} />
    <ResultRow label="Imposto devido" value={modelo.impostoDevido} />
    <ResultRow label="Imposto já pago" value={modelo.impostoPago} />
    <ResultRow label="Saldo estimado a pagar" value={modelo.saldoPagar} danger />
    <ResultRow label="Restituição estimada" value={modelo.restituicaoEstimada} success />
  </section>
);

const ResultRow = ({ label, value, danger = false, success = false }: { label: string; value: number; danger?: boolean; success?: boolean }) => (
  <div className={`resultado-row${danger ? ' perigo' : ''}${success ? ' verde' : ''}`}>
    <span className="r-label">{label}</span><span className="r-valor">{formatCurrency(value)}</span>
  </div>
);

const CurrencyField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => {
  const id = React.useId();
  return <div className="calc-field"><label htmlFor={id}>{label}</label><CurrencyInput id={id} value={value} onValueChange={onChange} /></div>;
};

const TextField = ({ label, value, type, onChange }: { label: string; value: string; type: 'number'; onChange: (value: string) => void }) => {
  const id = React.useId();
  return <div className="calc-field"><label htmlFor={id}>{label}</label><input id={id} type={type} min="0" step="1" value={value} onChange={(event) => onChange(event.target.value)} /></div>;
};
