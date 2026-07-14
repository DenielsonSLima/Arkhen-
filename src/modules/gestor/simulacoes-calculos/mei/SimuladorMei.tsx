import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Calculator, FileText, Gauge, Store } from 'lucide-react';
import { CurrencyInput } from '../../shared/CurrencyInput';
import { CompetenciaSelect } from '../../shared/CompetenciaSelect';
import { formatCompetencia } from '../../shared/dateDisplay';
import { cnaeCatalogQueryKey, parametrizacaoService } from '../../parametrizacao/services/parametrizacaoService';
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
  const cnaesQuery = useQuery({
    queryKey: cnaeCatalogQueryKey(false),
    queryFn: () => parametrizacaoService.getCnaes(),
    staleTime: 5 * 60 * 1000,
  });

  const updateParam = <K extends keyof SimulacaoMeiParams>(key: K, value: SimulacaoMeiParams[K]) =>
    setParams({ ...params, [key]: value });

  const updateCompetencia = (competencia: string) => setParams({
    ...params,
    competencia,
    ano: competencia.slice(0, 4),
  });

  const cnaesElegiveis = (cnaesQuery.data ?? []).filter((cnae) => (
    cnae.meiPermitido && cnae.meiTipo === params.tipoMei
  ));

  const updateReceita = (mes: keyof ReceitasMensaisMei, value: string) =>
    updateParam('receitasMensais', { ...params.receitasMensais, [mes]: value });

  return (
    <div className="calc-layout mei-layout">
      <div className="mei-form-stack">
        <section className="calc-form-card">
          <h3><Store size={18} color="#c59235" />Enquadramento do MEI</h3>

          <div className="mei-grid mei-grid--two">
            <CompetenciaSelect
              id="mei-competencia"
              label="Competência de referência"
              value={params.competencia}
              onChange={updateCompetencia}
            />
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
                onChange={(event) => setParams({ ...params, tipoMei: event.target.value as SimulacaoMeiParams['tipoMei'], ocupacaoCodigo: '' })}
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
              <label htmlFor="mei-ocupacao">CNAE cadastrado</label>
              <select
                id="mei-ocupacao"
                value={params.ocupacaoCodigo}
                onChange={(event) => updateParam('ocupacaoCodigo', event.target.value)}
                disabled={cnaesQuery.isLoading || cnaesQuery.isError}
              >
                <option value="">
                  {cnaesQuery.isLoading ? 'Carregando CNAEs...' : 'Selecione um CNAE parametrizado'}
                </option>
                {cnaesElegiveis.map((cnae) => (
                  <option key={cnae.id} value={cnae.codigo}>{cnae.codigo} — {cnae.descricao}</option>
                ))}
              </select>
              {cnaesQuery.isError
                ? <small className="mei-field-error">Não foi possível carregar os CNAEs cadastrados.</small>
                : <small>{cnaesElegiveis.length ? 'A lista mostra somente CNAEs ativos e permitidos para o tipo de MEI selecionado.' : 'Nenhum CNAE elegível está ativo para este tipo de MEI.'}</small>}
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

            <small className="mei-version">Parâmetros: {formatCompetencia(resultado.competenciaParametros)} · {resultado.versaoParametros}</small>
          </>
        )}
      </section>
    </div>
  );
};
