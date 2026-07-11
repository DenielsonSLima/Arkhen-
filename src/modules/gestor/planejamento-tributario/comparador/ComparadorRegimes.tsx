import React, { useState } from 'react';
import { type ComparativoRegimes } from '../services/planejamento.service';
import { formatCurrency, formatPercent } from '../services/planejamento.service';
import { AlertTriangle, Award, CheckCircle2, ChevronDown, ChevronUp, TrendingDown, XCircle } from 'lucide-react';
import { CurrencyInput } from '../../shared/CurrencyInput';
import type { AnexoDasParametro } from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

interface Props {
  comparativo: ComparativoRegimes;
  faturamentoInput: string;
  setFaturamentoInput: (v: string) => void;
  anexoInput: string;
  setAnexoInput: (v: string) => void;
  anexosDas: AnexoDasParametro[];
}

const REGIME_ICONS: Record<string, { cls: string; label: string }> = {
  'Simples Nacional': { cls: 'verde', label: 'SN' },
  'Lucro Presumido': { cls: 'azul', label: 'LP' },
  'Lucro Real': { cls: 'roxo', label: 'LR' },
};

const BARRA_CLS: Record<string, string> = {
  'Simples Nacional': 'sn',
  'Lucro Presumido': 'lp',
  'Lucro Real': 'lr',
};

export const ComparadorRegimes: React.FC<Props> = ({
  comparativo,
  faturamentoInput,
  setFaturamentoInput,
  anexoInput,
  setAnexoInput,
  anexosDas,
}) => {
  const [regimeDetalhado, setRegimeDetalhado] = useState<string | null>(null);
  const maxImposto = Math.max(...comparativo.resultados.map((r) => r.impostoAnual), 1);

  return (
    <div className="planejamento-tab-content">
      {/* Toolbar */}
      <div className="comparador-toolbar">
        <div className="comparador-field">
          <label>Faturamento Anual (R$)</label>
          <CurrencyInput
            value={faturamentoInput}
            onValueChange={setFaturamentoInput}
            placeholder="R$ 500.000,00"
          />
        </div>
        <div className="comparador-field">
          <label>Anexo Simples Nacional</label>
          <select value={anexoInput} onChange={(e) => setAnexoInput(e.target.value)}>
            {anexosDas.map((anexo) => (
              <option key={anexo.id} value={anexo.id}>
                {anexo.label}
              </option>
            ))}
          </select>
        </div>
        <div className="comparador-sugestao">
          <Award size={16} />
          Regime sugerido: <strong style={{ marginLeft: 4 }}>{comparativo.regimeSugerido}</strong>
        </div>
      </div>

      {/* Cards dos regimes */}
      <div className="regimes-grid">
        {comparativo.resultados.map((r) => {
          const isMelhor = r.regime === comparativo.regimeSugerido;
          const config = REGIME_ICONS[r.regime] ?? { cls: 'azul', label: '?' };
          const isDetalhado = regimeDetalhado === r.regime;
          return (
            <div key={r.regime} className={`regime-card${isMelhor ? ' melhor' : ''}`}>
              {isMelhor && <div className="regime-card-badge">✦ Recomendado</div>}
              <div className="regime-card-header">
                <div className={`regime-icon ${config.cls}`}>
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{config.label}</span>
                </div>
                <h3>{r.regime}</h3>
              </div>
              <div>
                <div className="regime-aliquota">
                  {formatPercent(r.aliquotaEfetiva)} <span>ef.</span>
                </div>
                <div className="regime-imposto-anual">
                  Imposto anual: <strong>{formatCurrency(r.impostoAnual)}</strong>
                </div>
                <div className="regime-imposto-anual" style={{ marginTop: 2 }}>
                  Mensal est.: <strong>{formatCurrency(r.impostoMensal)}</strong>
                </div>
              </div>
              <div className="regime-divider" />
              <div className="regime-listas">
                <div className="regime-lista-titulo">Vantagens</div>
                {r.vantagens.map((v) => (
                  <div key={v} className="regime-lista-item">
                    <CheckCircle2 size={13} className="dot-verde" style={{ flexShrink: 0, marginTop: 1 }} />
                    {v}
                  </div>
                ))}
                <div className="regime-lista-titulo" style={{ marginTop: 6 }}>Desvantagens</div>
                {r.desvantagens.map((d) => (
                  <div key={d} className="regime-lista-item">
                    <XCircle size={13} className="dot-vermelho" style={{ flexShrink: 0, marginTop: 1 }} />
                    {d}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="regime-detalhes-btn"
                aria-expanded={isDetalhado}
                onClick={() => setRegimeDetalhado(isDetalhado ? null : r.regime)}
              >
                {isDetalhado ? 'Ocultar detalhes' : 'Ver detalhes'}
                {isDetalhado ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {isDetalhado && (
                <div className="regime-detalhes">
                  <div className="regime-detalhes-header">
                    <span>{r.regime}</span>
                    <strong>{formatPercent(r.aliquotaEfetiva)} efetiva</strong>
                  </div>
                  <div className="regime-detalhes-row">
                    <span>Imposto anual</span>
                    <strong>{formatCurrency(r.impostoAnual)}</strong>
                  </div>
                  <div className="regime-detalhes-row">
                    <span>Imposto mensal</span>
                    <strong>{formatCurrency(r.impostoMensal)}</strong>
                  </div>
                  {r.comparacoes.map((comparacao) => (
                    <div key={comparacao.regime} className="regime-detalhes-row">
                      <span>
                        {comparacao.tipo === 'economia'
                          ? `Economia em relação ao ${comparacao.regime}`
                          : comparacao.tipo === 'custo_adicional'
                            ? `Custo maior que ${comparacao.regime}`
                            : `Mesmo custo que ${comparacao.regime}`}
                      </span>
                      <strong className={comparacao.tipo === 'custo_adicional' ? 'valor-alerta' : 'valor-economia'}>
                        {formatCurrency(comparacao.valor)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="recomendacao-grid">
        <div className="recomendacao-card">
          <div className="recomendacao-header">
            <div>
              <h3>Por que recomendamos esse regime?</h3>
              <span>{comparativo.regimeSugerido}</span>
            </div>
            <Award size={22} />
          </div>
          <div className="recomendacao-motivos">
            {comparativo.recomendacaoMotivos.map((motivo) => (
              <div key={motivo} className="recomendacao-motivo">
                <CheckCircle2 size={15} />
                <span>{motivo}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="limite-simples-alerta">
          <AlertTriangle size={22} />
          <div>
            <strong>Atenção</strong>
            <span>
              Caso o faturamento ultrapasse <b>{formatCurrency(comparativo.limiteSimplesNacional)}</b>, o Simples Nacional não poderá mais ser utilizado.
            </span>
          </div>
        </div>
      </div>

      {/* Economia estimada */}
      {comparativo.economiaEstimada > 0 && (
        <div className="economia-card">
          <TrendingDown size={32} color="#c59235" />
          <div className="economia-card-text">
            <h3>Economia Estimada ao Migrar para {comparativo.regimeSugerido}</h3>
            <div className="economia-valor">{formatCurrency(comparativo.economiaEstimada)} / ano</div>
          </div>
        </div>
      )}

      {/* Barras comparativas */}
      <div className="barras-grid" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 8 }}>
          Comparativo de Carga Tributária
        </div>
        {comparativo.resultados.map((r) => {
          const isMelhor = r.regime === comparativo.regimeSugerido;
          const pct = (r.impostoAnual / maxImposto) * 100;
          return (
            <div key={r.regime} className="barra-row">
              <div className="barra-label">{r.regime}</div>
              <div className="barra-track">
                <div
                  className={`barra-fill ${isMelhor ? 'melhor' : BARRA_CLS[r.regime]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="barra-valor">{formatCurrency(r.impostoAnual)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
