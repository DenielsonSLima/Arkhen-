import React from 'react';
import { AlertTriangle, Calculator, FileText, Gauge, Store } from 'lucide-react';
import { CurrencyInput } from '../../shared/CurrencyInput';
import { formatCurrency } from '../services/calculos.service';
import type {
  FaixaRiscoMei,
  ReceitasMensaisMei,
  ResultadoSimulacaoMei,
  SimulacaoMeiParams,
} from './types';
import './SimuladorMei.css';

interface SimuladorMeiProps {
  params: SimulacaoMeiParams;
  setParams: (params: SimulacaoMeiParams) => void;
  resultado: ResultadoSimulacaoMei | null;
}

const MESES: Array<{ key: keyof ReceitasMensaisMei; label: string }> = [
  { key: 'janeiro', label: 'Janeiro' },
  { key: 'fevereiro', label: 'Fevereiro' },
  { key: 'marco', label: 'Março' },
  { key: 'abril', label: 'Abril' },
  { key: 'maio', label: 'Maio' },
  { key: 'junho', label: 'Junho' },
  { key: 'julho', label: 'Julho' },
  { key: 'agosto', label: 'Agosto' },
  { key: 'setembro', label: 'Setembro' },
  { key: 'outubro', label: 'Outubro' },
  { key: 'novembro', label: 'Novembro' },
  { key: 'dezembro', label: 'Dezembro' },
];

const RISCO_CLASS: Record<FaixaRiscoMei, string> = {
  regular: 'mei-risk--regular',
  atencao: 'mei-risk--attention',
  excesso_ate_20: 'mei-risk--warning',
  excesso_acima_20: 'mei-risk--danger',
  impeditivo: 'mei-risk--danger',
};

const formatPercent = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export const SimuladorMei: React.FC<SimuladorMeiProps> = ({ params, setParams, resultado }) => {
  const updateParam = <K extends keyof SimulacaoMeiParams>(key: K, value: SimulacaoMeiParams[K]) =>
    setParams({ ...params, [key]: value });

  const updateReceita = (mes: keyof ReceitasMensaisMei, value: string) =>
    updateParam('receitasMensais', { ...params.receitasMensais, [mes]: value });

  return (
    <div className="calc-layout mei-layout">
      <div className="mei-form-stack">
        <section className="calc-form-card">
          <h3><Store size={18} color="#c59235" />Enquadramento do MEI</h3>

          <div className="mei-grid mei-grid--two">
            <div className="calc-field">
              <label htmlFor="mei-competencia">Competência de referência</label>
              <input
                id="mei-competencia"
                type="month"
                value={params.competencia}
                onChange={(event) => updateParam('competencia', event.target.value)}
              />
            </div>
            <div className="calc-field">
              <label htmlFor="mei-ano">Ano da simulação</label>
              <input
                id="mei-ano"
                type="number"
                min="2000"
                max="2100"
                value={params.ano}
                onChange={(event) => updateParam('ano', event.target.value)}
              />
            </div>
            <div className="calc-field">
              <label htmlFor="mei-abertura">Data de abertura</label>
              <input
                id="mei-abertura"
                type="date"
                value={params.dataAbertura}
                onChange={(event) => updateParam('dataAbertura', event.target.value)}
              />
            </div>
            <div className="calc-field">
              <label htmlFor="mei-tipo">Tipo de MEI</label>
              <select
                id="mei-tipo"
                value={params.tipoMei}
                onChange={(event) => updateParam('tipoMei', event.target.value as SimulacaoMeiParams['tipoMei'])}
              >
                <option value="normal">MEI</option>
                <option value="caminhoneiro">MEI Caminhoneiro</option>
              </select>
            </div>
            <div className="calc-field">
              <label htmlFor="mei-atividade">Atividade para estimativa do DAS</label>
              <select
                id="mei-atividade"
                value={params.atividade}
                onChange={(event) => updateParam('atividade', event.target.value as SimulacaoMeiParams['atividade'])}
              >
                <option value="comercio">Comércio / indústria</option>
                <option value="servico">Serviços</option>
                <option value="comercio_servico">Comércio e serviços</option>
              </select>
            </div>
          </div>
        </section>

        <section className="calc-form-card">
          <h3><FileText size={18} color="#c59235" />Receitas mensais</h3>
          <p className="mei-helper">Informe as receitas brutas. O acumulado e a projeção são calculados pelo servidor.</p>
          <div className="mei-grid mei-grid--months">
            {MESES.map(({ key, label }) => (
              <div className="calc-field" key={key}>
                <label htmlFor={`mei-receita-${key}`}>{label}</label>
                <CurrencyInput
                  id={`mei-receita-${key}`}
                  value={params.receitasMensais[key]}
                  onValueChange={(value) => updateReceita(key, value)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="calc-form-card">
          <h3><AlertTriangle size={18} color="#c59235" />Condições de permanência</h3>
          <div className="mei-checks">
            <div className="calc-field">
              <label htmlFor="mei-empregados">Quantidade de empregados</label>
              <input
                id="mei-empregados"
                type="number"
                min="0"
                step="1"
                value={params.quantidadeEmpregados}
                onChange={(event) => updateParam('quantidadeEmpregados', event.target.value)}
              />
              <small>O servidor valida o limite permitido para a competência.</small>
            </div>
            <div className="calc-field">
              <label htmlFor="mei-ocupacao">Código da ocupação ou CNAE</label>
              <input
                id="mei-ocupacao"
                value={params.ocupacaoCodigo}
                placeholder="Ex.: 8599-6/04"
                onChange={(event) => updateParam('ocupacaoCodigo', event.target.value)}
              />
              <small>A permissão é conferida na tabela tributária versionada.</small>
            </div>
            <label className="calc-check-row">
              <input
                type="checkbox"
                checked={params.possuiSocio}
                onChange={(event) => updateParam('possuiSocio', event.target.checked)}
              />
              Possui sócio
            </label>
            <label className="calc-check-row">
              <input
                type="checkbox"
                checked={params.possuiFilial}
                onChange={(event) => updateParam('possuiFilial', event.target.checked)}
              />
              Possui filial
            </label>
          </div>
        </section>
      </div>

      <section className="resultado-card mei-result" aria-live="polite">
        <h3><Calculator size={18} color="#c59235" />Projeção e enquadramento</h3>
        {!resultado ? (
          <div className="mei-empty"><Gauge size={28} />Preencha os dados para consultar a simulação.</div>
        ) : (
          <>
            <div className={`mei-risk ${RISCO_CLASS[resultado.faixaRisco]}`}>
              <span>Faixa de risco</span>
              <strong>{resultado.faixaRiscoDescricao}</strong>
            </div>
            <div className="resultado-row">
              <span className="r-label">Limite anual</span>
              <span className="r-valor">{formatCurrency(resultado.limiteAnual)}</span>
            </div>
            <div className="resultado-row">
              <span className="r-label">Limite proporcional</span>
              <span className="r-valor">{formatCurrency(resultado.limiteProporcional)}</span>
            </div>
            <div className="resultado-row">
              <span className="r-label">Receita acumulada</span>
              <span className="r-valor">{formatCurrency(resultado.receitaAcumulada)}</span>
            </div>
            <div className="resultado-row">
              <span className="r-label">Receita projetada</span>
              <span className="r-valor">{formatCurrency(resultado.receitaProjetada)}</span>
            </div>
            <div className="resultado-row destaque">
              <span className="r-label">Percentual do limite utilizado</span>
              <span className="r-valor">{formatPercent(resultado.percentualUtilizado)}</span>
            </div>
            <div className="resultado-row perigo">
              <span className="r-label">Excesso apurado</span>
              <span className="r-valor">{formatCurrency(resultado.valorExcesso)}</span>
            </div>

            <div className="mei-explanation">
              <strong>Possível efeito no enquadramento</strong>
              <p>{resultado.desenquadramentoDescricao}</p>
            </div>

            {resultado.memoriaCalculo.length > 0 && (
              <div className="mei-detail-list">
                <strong>Memória de cálculo</strong>
                {resultado.memoriaCalculo.map((item, index) => (
                  <div key={`${item.descricao}-${index}`}><span>{item.descricao}</span><b>{item.valor}</b></div>
                ))}
              </div>
            )}

            {resultado.alertas.length > 0 && (
              <div className="mei-alerts">
                {resultado.alertas.map((alerta, index) => (
                  <div key={`${alerta}-${index}`}><AlertTriangle size={15} />{alerta}</div>
                ))}
              </div>
            )}

            <small className="mei-version">Parâmetros: {resultado.competenciaParametros} · {resultado.versaoParametros}</small>
          </>
        )}
      </section>
    </div>
  );
};
