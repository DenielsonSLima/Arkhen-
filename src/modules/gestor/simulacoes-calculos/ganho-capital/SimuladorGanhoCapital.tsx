import React from 'react';
import {
  AlertTriangle,
  Calculator,
  CalendarClock,
  CircleDollarSign,
  FileCheck2,
  Home,
  ReceiptText,
} from 'lucide-react';
import { CurrencyInput } from '../../shared/CurrencyInput';
import { formatCompetencia, formatDateBr } from '../../shared/dateDisplay';
import { formatCurrency } from '../services/calculos.service';
import type {
  ResultadoSimulacaoGanhoCapital,
  SimulacaoGanhoCapitalParams,
  TipoBemGanhoCapital,
} from './types';
import './SimuladorGanhoCapital.css';

interface SimuladorGanhoCapitalProps {
  params: SimulacaoGanhoCapitalParams;
  setParams: (params: SimulacaoGanhoCapitalParams) => void;
  resultado: ResultadoSimulacaoGanhoCapital | null;
}

const TIPOS_BEM: Array<{ value: TipoBemGanhoCapital; label: string }> = [
  { value: 'imovel', label: 'Imóvel' },
  { value: 'imovel_residencial', label: 'Imóvel residencial' },
  { value: 'veiculo', label: 'Veículo' },
  { value: 'participacao_societaria', label: 'Participação societária' },
  { value: 'outros', label: 'Outros bens e direitos' },
];

const formatPercent = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`;

export const SimuladorGanhoCapital: React.FC<SimuladorGanhoCapitalProps> = ({
  params,
  setParams,
  resultado,
}) => {
  const updateParam = <K extends keyof SimulacaoGanhoCapitalParams>(
    key: K,
    value: SimulacaoGanhoCapitalParams[K],
  ) => setParams({ ...params, [key]: value });

  const updateParcela = (index: number, key: 'data' | 'valor', value: string) => {
    updateParam('cronogramaParcelas', params.cronogramaParcelas.map((parcela, atual) => atual === index ? { ...parcela, [key]: value } : parcela));
  };

  return (
    <div className="calc-layout ganho-capital-layout">
      <div className="ganho-capital-form-stack">
        <section className="calc-form-card">
          <h3><CircleDollarSign size={18} color="#c59235" />Aquisição e alienação</h3>
          <div className="ganho-capital-grid ganho-capital-grid--two">
            <div className="calc-field ganho-capital-grid__wide">
              <label htmlFor="ganho-tipo-bem">Tipo do bem ou direito</label>
              <select
                id="ganho-tipo-bem"
                value={params.tipoBem}
                onChange={(event) => updateParam('tipoBem', event.target.value as TipoBemGanhoCapital)}
              >
                {TIPOS_BEM.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
              </select>
            </div>
            <div className="calc-field">
              <label htmlFor="ganho-data-aquisicao">Data de aquisição</label>
              <input
                id="ganho-data-aquisicao"
                type="date"
                value={params.dataAquisicao}
                onChange={(event) => updateParam('dataAquisicao', event.target.value)}
              />
            </div>
            <div className="calc-field">
              <label htmlFor="ganho-data-venda">Data da venda</label>
              <input
                id="ganho-data-venda"
                type="date"
                value={params.dataVenda}
                onChange={(event) => updateParam('dataVenda', event.target.value)}
              />
            </div>
            <div className="calc-field">
              <label htmlFor="ganho-custo-aquisicao">Custo de aquisição</label>
              <CurrencyInput
                id="ganho-custo-aquisicao"
                value={params.custoAquisicao}
                onValueChange={(value) => updateParam('custoAquisicao', value)}
              />
            </div>
            <div className="calc-field">
              <label htmlFor="ganho-benfeitorias">Benfeitorias comprovadas</label>
              <CurrencyInput
                id="ganho-benfeitorias"
                value={params.benfeitorias}
                onValueChange={(value) => updateParam('benfeitorias', value)}
              />
            </div>
            <div className="calc-field">
              <label htmlFor="ganho-valor-venda">Valor da venda</label>
              <CurrencyInput
                id="ganho-valor-venda"
                value={params.valorVenda}
                onValueChange={(value) => updateParam('valorVenda', value)}
              />
            </div>
            <div className="calc-field">
              <label htmlFor="ganho-despesas-alienacao">Despesas da alienação</label>
              <CurrencyInput
                id="ganho-despesas-alienacao"
                value={params.despesasAlienacao}
                onValueChange={(value) => updateParam('despesasAlienacao', value)}
              />
            </div>
            <div className="calc-field">
              <label htmlFor="ganho-participacao">Participação no bem (%)</label>
              <input
                id="ganho-participacao"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={params.percentualParticipacao}
                onChange={(event) => updateParam('percentualParticipacao', event.target.value)}
              />
            </div>
            <div className="calc-field ganho-capital-grid__wide">
              <label htmlFor="ganho-total-alienacoes">Total de alienações de bens da mesma natureza no mês</label>
              <CurrencyInput
                id="ganho-total-alienacoes"
                value={params.totalAlienacoesMesMesmaNatureza}
                onValueChange={(value) => updateParam('totalAlienacoesMesMesmaNatureza', value)}
              />
              <small>Informe o total antes de aplicar a participação; o servidor faz a proporção.</small>
            </div>
          </div>
        </section>

        {(params.tipoBem === 'imovel' || params.tipoBem === 'imovel_residencial') && (
          <section className="calc-form-card">
            <h3><Home size={18} color="#c59235" />Reinvestimento residencial</h3>
            <label className="calc-check-row ganho-capital-check">
              <input
                type="checkbox"
                checked={params.reinvestimentoImovel180Dias}
                onChange={(event) => updateParam('reinvestimentoImovel180Dias', event.target.checked)}
              />
              Houve reinvestimento em imóvel residencial no prazo de 180 dias
            </label>
            <label className="calc-check-row ganho-capital-check">
              <input
                type="checkbox"
                checked={params.unicoImovelAte440Mil}
                onChange={(event) => updateParam('unicoImovelAte440Mil', event.target.checked)}
              />
              É o único imóvel do titular e a venda total não supera R$ 440 mil
            </label>
            {params.unicoImovelAte440Mil && (
              <label className="calc-check-row ganho-capital-check">
                <input
                  type="checkbox"
                  checked={params.semOutraAlienacaoImovel5Anos}
                  onChange={(event) => updateParam('semOutraAlienacaoImovel5Anos', event.target.checked)}
                />
                Não houve outra alienação de imóvel nos últimos 5 anos
              </label>
            )}
            {params.reinvestimentoImovel180Dias && (
              <div className="ganho-capital-grid ganho-capital-grid--two ganho-capital-conditional">
                <div className="calc-field">
                  <label htmlFor="ganho-data-reinvestimento">Data do reinvestimento</label>
                  <input
                    id="ganho-data-reinvestimento"
                    type="date"
                    value={params.dataReinvestimento}
                    onChange={(event) => updateParam('dataReinvestimento', event.target.value)}
                  />
                </div>
                <div className="calc-field">
                  <label htmlFor="ganho-valor-reinvestido">Valor reinvestido</label>
                  <CurrencyInput
                    id="ganho-valor-reinvestido"
                    value={params.valorReinvestido}
                    onValueChange={(value) => updateParam('valorReinvestido', value)}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        <section className="calc-form-card">
          <h3><CalendarClock size={18} color="#c59235" />Forma de recebimento</h3>
          <label className="calc-check-row ganho-capital-check">
            <input
              type="checkbox"
              checked={params.vendaParcelada}
              onChange={(event) => updateParam('vendaParcelada', event.target.checked)}
            />
            Venda com recebimento parcelado
          </label>
          {params.vendaParcelada && (
            <div className="ganho-capital-conditional">
              <p className="ganho-capital-helper">Informe cada recebimento; o servidor distribui o imposto pelo cronograma declarado.</p>
              {params.cronogramaParcelas.map((parcela, index) => (
                <div className="ganho-capital-grid ganho-capital-grid--two" key={`parcela-${index}`}>
                  <div className="calc-field">
                    <label htmlFor={`ganho-parcela-data-${index}`}>Data do recebimento {index + 1}</label>
                    <input id={`ganho-parcela-data-${index}`} type="date" value={parcela.data} onChange={(event) => updateParcela(index, 'data', event.target.value)} />
                  </div>
                  <div className="calc-field">
                    <label htmlFor={`ganho-parcela-valor-${index}`}>Valor recebido {index + 1}</label>
                    <CurrencyInput id={`ganho-parcela-valor-${index}`} value={parcela.valor} onValueChange={(value) => updateParcela(index, 'valor', value)} />
                  </div>
                  <button type="button" className="btn-cancel" onClick={() => updateParam('cronogramaParcelas', params.cronogramaParcelas.filter((_, atual) => atual !== index))}>Remover recebimento</button>
                </div>
              ))}
              <button type="button" className="btn-cancel" onClick={() => updateParam('cronogramaParcelas', [...params.cronogramaParcelas, { data: '', valor: '' }])}>
                Adicionar recebimento
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="resultado-card ganho-capital-result" aria-live="polite">
        <h3><Calculator size={18} color="#c59235" />Apuração estimada</h3>
        {!resultado ? (
          <div className="ganho-capital-empty"><ReceiptText size={28} />Preencha os dados para consultar a apuração.</div>
        ) : (
          <>
            <div className="resultado-row">
              <span className="r-label">Custo ajustado</span>
              <span className="r-valor">{formatCurrency(resultado.custoAjustado)}</span>
            </div>
            <div className="resultado-row">
              <span className="r-label">Ganho bruto</span>
              <span className="r-valor">{formatCurrency(resultado.ganhoBruto)}</span>
            </div>
            <div className="resultado-row verde">
              <span className="r-label">Parcela isenta</span>
              <span className="r-valor">{formatCurrency(resultado.valorIsento)}</span>
            </div>
            <div className="resultado-row">
              <span className="r-label">Base de cálculo</span>
              <span className="r-valor">{formatCurrency(resultado.baseCalculo)}</span>
            </div>
            <div className="resultado-row">
              <span className="r-label">Alíquota marginal</span>
              <span className="r-valor">{formatPercent(resultado.aliquotaMarginal)}</span>
            </div>
            <div className="resultado-row">
              <span className="r-label">Alíquota efetiva</span>
              <span className="r-valor">{formatPercent(resultado.aliquotaEfetiva)}</span>
            </div>
            <div className="resultado-row destaque">
              <span className="r-label">Imposto estimado</span>
              <span className="r-valor">{formatCurrency(resultado.impostoEstimado)}</span>
            </div>
            <div className="ganho-capital-due">
              <CalendarClock size={17} />
              <div><span>Vencimento estimado</span><strong>{formatDateBr(resultado.vencimento)}</strong></div>
            </div>

            <div className="ganho-capital-note">
              <FileCheck2 size={17} />
              <div><strong>Tratamento da isenção</strong><p>{resultado.isencaoDescricao}</p></div>
            </div>

            {resultado.memoriaCalculo.length > 0 && (
              <div className="ganho-capital-memory">
                <strong>Memória de cálculo</strong>
                {resultado.memoriaCalculo.map((item, index) => (
                  <div key={`${item.descricao}-${index}`}><span>{item.descricao}</span><b>{item.valor}</b></div>
                ))}
              </div>
            )}

            {resultado.parcelas.length > 0 && (
              <div className="ganho-capital-installments">
                <strong>Recebimento parcelado</strong>
                {resultado.parcelas.map((parcela) => (
                  <div key={parcela.numero}>
                    <span>{parcela.numero}ª · {formatDateBr(parcela.vencimento)}</span>
                    <b>{formatCurrency(parcela.impostoEstimado)}</b>
                  </div>
                ))}
              </div>
            )}

            {resultado.alertas.length > 0 && (
              <div className="ganho-capital-alerts">
                {resultado.alertas.map((alerta, index) => (
                  <div key={`${alerta}-${index}`}><AlertTriangle size={15} />{alerta}</div>
                ))}
              </div>
            )}

            <div className="ganho-capital-gcap">
              Resultado preparatório. Confira a operação e faça a apuração oficial no GCAP.
            </div>
            <small className="ganho-capital-version">Parâmetros: {formatCompetencia(resultado.competenciaParametros)} · {resultado.versaoParametros}</small>
          </>
        )}
      </section>
    </div>
  );
};
