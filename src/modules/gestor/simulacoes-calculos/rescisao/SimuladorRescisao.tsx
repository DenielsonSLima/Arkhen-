import React from 'react';
import { FileX2, Calculator } from 'lucide-react';
import { type ResultadoRescisao, formatCurrency } from '../services/calculos.service';
import { CurrencyInput } from '../../shared/CurrencyInput';
import type { TipoRescisaoParametro } from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';
import type { AdicionalTempoServicoTipo, AvisoPrevioModo } from '../hooks/useSimulacoesCalculos';

interface Params {
  tipo: string;
  avisoPrevioModo: AvisoPrevioModo;
  salario: string;
  dataAdmissao: string;
  dataDemissao: string;
  saldoFGTS: string;
  feriasVencidasPeriodos: string;
  feriasVencidasEmDobro: boolean;
  adicionalTempoServicoAtivo: boolean;
  adicionalTempoServicoTipo: AdicionalTempoServicoTipo;
  adicionalTempoServicoPercentual: string;
  adicionalTempoServicoValor: string;
}

interface Props {
  params: Params;
  setParams: (p: Params) => void;
  resultado: ResultadoRescisao;
  tiposRescisao: TipoRescisaoParametro[];
}

const AVISO_PREVIO_OPCOES: { id: AvisoPrevioModo; label: string; desc: string }[] = [
  { id: 'cumprido', label: 'Cumpriu 30 dias', desc: 'Não soma nem desconta aviso prévio.' },
  { id: 'descontado', label: 'Não cumpriu', desc: 'Desconta 30 dias de aviso do valor líquido.' },
  { id: 'indenizado', label: 'Indenizado', desc: 'Soma aviso prévio indenizado nas verbas.' },
];

const ADICIONAL_TEMPO_SERVICO_OPCOES: { id: AdicionalTempoServicoTipo; label: string }[] = [
  { id: 'trienio', label: 'Triênio' },
  { id: 'quinquenio', label: 'Quinquênio' },
  { id: 'manual', label: 'Valor manual' },
];

export const SimuladorRescisao: React.FC<Props> = ({ params, setParams, resultado, tiposRescisao }) => {
  const set = (key: keyof Params) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParams({ ...params, [key]: e.target.value });

  return (
    <div className="calc-layout">
      <div className="calc-form-card">
        <h3><FileX2 size={18} color="#c59235" />Dados da Rescisão</h3>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 8 }}>
            Tipo de Rescisão
          </label>
          <div className="tipo-rescisao-grid">
            {tiposRescisao.map((tipo) => (
              <button
                key={tipo.id}
                className={`tipo-rescisao-btn${params.tipo === tipo.id ? ' active' : ''}`}
                onClick={() => setParams({ ...params, tipo: tipo.id })}
                title={tipo.descricao}
              >
                {tipo.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 8 }}>
            Aviso Prévio
          </label>
          <div className="aviso-previo-grid">
            {AVISO_PREVIO_OPCOES.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                className={`aviso-previo-btn${params.avisoPrevioModo === opcao.id ? ' active' : ''}`}
                onClick={() => setParams({ ...params, avisoPrevioModo: opcao.id })}
                title={opcao.desc}
              >
                <span>{opcao.label}</span>
                <small>{opcao.desc}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="calc-field">
          <label>Último Salário (R$)</label>
          <CurrencyInput
            value={params.salario}
            onValueChange={(value) => setParams({ ...params, salario: value })}
          />
        </div>
        <div className="calc-field">
          <label>Data de Admissão</label>
          <input type="date" value={params.dataAdmissao} onChange={set('dataAdmissao')} />
        </div>
        <div className="calc-field">
          <label>Data de Demissão</label>
          <input type="date" value={params.dataDemissao} onChange={set('dataDemissao')} />
        </div>
        <div className="calc-field">
          <label>Saldo do FGTS (R$)</label>
          <CurrencyInput
            value={params.saldoFGTS}
            onValueChange={(value) => setParams({ ...params, saldoFGTS: value })}
          />
        </div>

        <div className="rescisao-extra-section">
          <div className="rescisao-section-title">Férias vencidas</div>
          <div className="rescisao-select-grid">
            <div className="calc-field">
              <label>Períodos vencidos</label>
              <input
                type="number"
                min="0"
                step="1"
                value={params.feriasVencidasPeriodos}
                onChange={set('feriasVencidasPeriodos')}
              />
            </div>
            <label className="calc-check-row rescisao-check-row">
              <input
                type="checkbox"
                checked={params.feriasVencidasEmDobro}
                onChange={(event) => setParams({ ...params, feriasVencidasEmDobro: event.target.checked })}
              />
              <span>Pagar vencidas em dobro</span>
            </label>
          </div>
          <small className="rescisao-help-text">
            Use o dobro quando o período concessivo já tiver sido ultrapassado.
          </small>
        </div>

        <div className="rescisao-extra-section">
          <label className="calc-check-row">
            <input
              type="checkbox"
              checked={params.adicionalTempoServicoAtivo}
              onChange={(event) => setParams({ ...params, adicionalTempoServicoAtivo: event.target.checked })}
            />
            <span>Possui adicional por tempo de serviço</span>
          </label>
          {params.adicionalTempoServicoAtivo && (
            <div className="rescisao-adicional-grid">
              <div className="calc-field">
                <label>Tipo</label>
                <select
                  value={params.adicionalTempoServicoTipo}
                  onChange={(event) => setParams({
                    ...params,
                    adicionalTempoServicoTipo: event.target.value as AdicionalTempoServicoTipo,
                  })}
                >
                  {ADICIONAL_TEMPO_SERVICO_OPCOES.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>{opcao.label}</option>
                  ))}
                </select>
              </div>
              {params.adicionalTempoServicoTipo === 'manual' ? (
                <div className="calc-field">
                  <label>Valor mensal (R$)</label>
                  <CurrencyInput
                    value={params.adicionalTempoServicoValor}
                    onValueChange={(value) => setParams({ ...params, adicionalTempoServicoValor: value })}
                  />
                </div>
              ) : (
                <div className="calc-field">
                  <label>Percentual por período (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={params.adicionalTempoServicoPercentual}
                    onChange={set('adicionalTempoServicoPercentual')}
                  />
                </div>
              )}
            </div>
          )}
          <small className="rescisao-help-text">
            Triênio/quinquênio depende de CCT, ACT, estatuto ou política interna; por isso fica opcional.
          </small>
        </div>
      </div>

      <div className="resultado-card">
        <h3><Calculator size={18} color="#c59235" />Verbas Rescisórias</h3>
        <div className="resultado-row">
          <span className="r-label">Saldo de Salário</span>
          <span className="r-valor">{formatCurrency(resultado.saldoSalario)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">13º Proporcional</span>
          <span className="r-valor">{formatCurrency(resultado.decimoTerceiroProporcional)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">Férias Proporcionais</span>
          <span className="r-valor">{formatCurrency(resultado.feriasProporcionais)}</span>
        </div>
        <div className="resultado-row">
          <span className="r-label">Adicional de 1/3 de Férias</span>
          <span className="r-valor">{formatCurrency(resultado.adicionalFerias)}</span>
        </div>
        {resultado.feriasVencidas > 0 && (
          <div className="resultado-row">
            <span className="r-label">Férias Vencidas</span>
            <span className="r-valor">{formatCurrency(resultado.feriasVencidas)}</span>
          </div>
        )}
        {resultado.adicionalFeriasVencidas > 0 && (
          <div className="resultado-row">
            <span className="r-label">1/3 sobre Férias Vencidas</span>
            <span className="r-valor">{formatCurrency(resultado.adicionalFeriasVencidas)}</span>
          </div>
        )}
        {resultado.adicionalTempoServico > 0 && (
          <div className="resultado-row azul">
            <span className="r-label">Adicional Tempo Serviço</span>
            <span className="r-valor">{formatCurrency(resultado.adicionalTempoServico)}</span>
          </div>
        )}
        {resultado.avisoPrevio > 0 && (
          <div className="resultado-row">
            <span className="r-label">Aviso Prévio Indenizado</span>
            <span className="r-valor">{formatCurrency(resultado.avisoPrevio)}</span>
          </div>
        )}
        {resultado.multaFGTS > 0 && (
          <div className="resultado-row azul">
            <span className="r-label">Multa FGTS (conta vinculada)</span>
            <span className="r-valor">{formatCurrency(resultado.multaFGTS)}</span>
          </div>
        )}
        {(resultado.fgtsRescisorio ?? 0) > 0 && (
          <div className="resultado-row azul">
            <span className="r-label">FGTS rescisório estimado</span>
            <span className="r-valor">{formatCurrency(resultado.fgtsRescisorio ?? 0)}</span>
          </div>
        )}
        <div className="resultado-row">
          <span className="r-label">Total Bruto</span>
          <span className="r-valor">{formatCurrency(resultado.totalBruto)}</span>
        </div>
        {resultado.avisoPrevioDesconto > 0 && (
          <div className="resultado-row perigo">
            <span className="r-label">(-) Aviso Prévio Não Cumprido</span>
            <span className="r-valor">- {formatCurrency(resultado.avisoPrevioDesconto)}</span>
          </div>
        )}
        <div className="resultado-row perigo">
          <span className="r-label">(-) INSS</span>
          <span className="r-valor">- {formatCurrency(resultado.inssRescisao)}</span>
        </div>
        <div className="resultado-row perigo">
          <span className="r-label">(-) IRRF</span>
          <span className="r-valor">- {formatCurrency(resultado.irrfRescisao)}</span>
        </div>
        <div className="resultado-row destaque verde">
          <span className="r-label">Líquido das verbas do TRCT</span>
          <span className="r-valor">{formatCurrency(resultado.totalLiquido)}</span>
        </div>
        {resultado.multaFGTS > 0 && (
          <small className="rescisao-help-text">
            A multa do FGTS não integra este líquido: ela é recolhida na conta vinculada do trabalhador.
          </small>
        )}
      </div>
    </div>
  );
};
