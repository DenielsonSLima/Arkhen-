import React from 'react';
import {
  BarChart3,
  Calculator,
  Clock3,
  FileText,
  HeartPulse,
  Info,
  MapPin,
  TrendingUp,
  Users,
} from 'lucide-react';
import { type ResultadoFolha, formatCurrency, formatPercent } from '../services/calculos.service';
import { CurrencyInput } from '../../shared/CurrencyInput';
import type { AdicionalTempoServicoTipo } from '../hooks/useSimulacoesCalculos';
import './SimuladorFolha.css';

interface Params {
  tipoFuncionario: string;
  competencia: string;
  regiao: string;
  salarioBruto: string;
  dependentes: string;
  adicionalPericulosidade: string;
  adicionalNoturnoPercentual: string;
  insalubridadePercentual: string;
  adicionalTempoServicoAtivo: boolean;
  adicionalTempoServicoTipo: AdicionalTempoServicoTipo;
  adicionalTempoServicoAnos: string;
  adicionalTempoServicoPercentual: string;
  adicionalTempoServicoValor: string;
  horasExtras50: string;
  valorHora50: string;
  horasExtras100: string;
  valorHora100: string;
  horasExtras150: string;
  valorHora150: string;
  horasExtrasDomingo: string;
  valorHoraDomingo: string;
  horasExtrasFeriado: string;
  valorHoraFeriado: string;
  valeTransporteAtivo: boolean;
  valorValeTransporte: string;
  valeAlimentacaoEmpresa: string;
  valeAlimentacaoDesconto: string;
  planoSaudeEmpresa: string;
  planoSaudeDesconto: string;
  odontologicoEmpresa: string;
  odontologicoDesconto: string;
  pensaoAlimenticia: string;
  faltasDias: string;
  atestadosDias: string;
  descontoManualDescricao: string;
  descontoManualValor: string;
  adicionalManualDescricao: string;
  adicionalManualValor: string;
  salarioComparacao: string;
  aumentoPercentual: string;
}

interface Props {
  params: Params;
  setParams: (p: Params) => void;
  resultado: ResultadoFolha;
}

const TIPOS_FUNCIONARIO = [
  { id: 'clt', label: 'CLT' },
  { id: 'aprendiz', label: 'Aprendiz' },
  { id: 'estagiario', label: 'Estagiário' },
  { id: 'domestico', label: 'Doméstico' },
  { id: 'diretor', label: 'Diretor' },
  { id: 'prolabore', label: 'Pró-labore' },
];

const REGIOES = [
  { id: 'nacional', label: 'Brasil' },
  { id: 'norte', label: 'Norte' },
  { id: 'nordeste', label: 'Nordeste' },
  { id: 'centro_oeste', label: 'Centro-Oeste' },
  { id: 'sudeste', label: 'Sudeste' },
  { id: 'sul', label: 'Sul' },
];

const ADICIONAL_TEMPO_SERVICO_OPCOES: { id: AdicionalTempoServicoTipo; label: string }[] = [
  { id: 'trienio', label: 'Triênio' },
  { id: 'quinquenio', label: 'Quinquênio' },
  { id: 'manual', label: 'Valor manual' },
];

export const SimuladorFolha: React.FC<Props> = ({ params, setParams, resultado }) => {
  const updateParam = <K extends keyof Params>(key: K, value: Params[K]) =>
    setParams({ ...params, [key]: value });
  const setText = (key: keyof Params) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    updateParam(key, event.target.value as Params[typeof key]);

  return (
    <div className="folha-workspace">
      <div className="folha-form-stack">
        <section className="calc-form-card folha-card">
          <h3><Users size={18} color="#c59235" />Dados do Funcionário</h3>

          <div className="folha-section">
            <div className="folha-section-title">Tipo de funcionário</div>
            <div className="folha-segmented">
              {TIPOS_FUNCIONARIO.map((tipo) => (
                <button
                  key={tipo.id}
                  type="button"
                  className={params.tipoFuncionario === tipo.id ? 'active' : ''}
                  onClick={() => updateParam('tipoFuncionario', tipo.id)}
                >
                  {tipo.label}
                </button>
              ))}
            </div>
          </div>

          <div className="folha-grid two">
            <div className="calc-field">
              <label>Competência</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={params.competencia.split('-')[1] || '06'}
                  onChange={(e) => {
                    const year = params.competencia.split('-')[0] || '2026';
                    updateParam('competencia', `${year}-${e.target.value}`);
                  }}
                  style={{
                    flex: 1.2,
                    backgroundColor: '#FFFFFF',
                    color: '#111827',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  <option value="01">Janeiro</option>
                  <option value="02">Fevereiro</option>
                  <option value="03">Março</option>
                  <option value="04">Abril</option>
                  <option value="05">Maio</option>
                  <option value="06">Junho</option>
                  <option value="07">Julho</option>
                  <option value="08">Agosto</option>
                  <option value="09">Setembro</option>
                  <option value="10">Outubro</option>
                  <option value="11">Novembro</option>
                  <option value="12">Dezembro</option>
                </select>
                <select
                  value={params.competencia.split('-')[0] || '2026'}
                  onChange={(e) => {
                    const month = params.competencia.split('-')[1] || '06';
                    updateParam('competencia', `${e.target.value}-${month}`);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: '#FFFFFF',
                    color: '#111827',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => (
                    <option key={y} value={y.toString()}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="calc-field">
              <InfoLabel label="Região do Brasil" items={['Usada para simular impacto de SAT/FAP.', 'Também prepara sindicato e regras regionais futuras.']} />
              <select value={params.regiao} onChange={setText('regiao')}>
                {REGIOES.map((regiao) => <option key={regiao.id} value={regiao.id}>{regiao.label}</option>)}
              </select>
            </div>
            <div className="calc-field">
              <label>Salário Bruto (R$)</label>
              <CurrencyInput value={params.salarioBruto} onValueChange={(value) => updateParam('salarioBruto', value)} />
            </div>
            <div className="calc-field">
              <label>Número de Dependentes</label>
              <input type="number" value={params.dependentes} onChange={setText('dependentes')} min={0} max={10} />
            </div>
          </div>
        </section>

        <section className="calc-form-card folha-card">
          <h3><Clock3 size={18} color="#c59235" />Adicionais e Horas</h3>
          <div className="folha-grid three">
            <MoneyField label="Periculosidade" value={params.adicionalPericulosidade} onChange={(value) => updateParam('adicionalPericulosidade', value)} />
            <PercentField label="Adicional Noturno" value={params.adicionalNoturnoPercentual} onChange={setText('adicionalNoturnoPercentual')} />
            <div className="calc-field">
              <InfoLabel label="Insalubridade" items={['10%: grau mínimo.', '20%: grau médio.', '40%: grau máximo.']} />
              <select value={params.insalubridadePercentual} onChange={setText('insalubridadePercentual')}>
                <option value="0">Não aplica</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
                <option value="40">40%</option>
              </select>
            </div>
          </div>

          <div className="folha-adicional-tempo">
            <label className="folha-check">
              <input
                type="checkbox"
                checked={params.adicionalTempoServicoAtivo}
                onChange={(event) => updateParam('adicionalTempoServicoAtivo', event.target.checked)}
              />
              Adicional por tempo de serviço
            </label>
            {params.adicionalTempoServicoAtivo && (
              <div className="folha-grid three">
                <div className="calc-field">
                  <InfoLabel label="Tipo do adicional" items={['Use triênio quando a CCT/ACT prever adicional a cada 3 anos.', 'Use manual para informar um valor mensal fechado.']} />
                  <select
                    value={params.adicionalTempoServicoTipo}
                    onChange={(event) => updateParam('adicionalTempoServicoTipo', event.target.value as AdicionalTempoServicoTipo)}
                  >
                    {ADICIONAL_TEMPO_SERVICO_OPCOES.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>{opcao.label}</option>
                    ))}
                  </select>
                </div>
                {params.adicionalTempoServicoTipo !== 'manual' && (
                  <>
                    <NumberField label="Anos completos" value={params.adicionalTempoServicoAnos} onChange={setText('adicionalTempoServicoAnos')} />
                    <PercentField label="% por período" value={params.adicionalTempoServicoPercentual} onChange={setText('adicionalTempoServicoPercentual')} />
                  </>
                )}
                {params.adicionalTempoServicoTipo === 'manual' && (
                  <MoneyField label="Valor mensal" value={params.adicionalTempoServicoValor} onChange={(value) => updateParam('adicionalTempoServicoValor', value)} />
                )}
              </div>
            )}
          </div>

          <div className="folha-hours-table">
            <HourRow label="Hora extra 50%" qtd={params.horasExtras50} valor={params.valorHora50} onQtd={setText('horasExtras50')} onValor={(value) => updateParam('valorHora50', value)} />
            <HourRow label="Hora extra 100%" qtd={params.horasExtras100} valor={params.valorHora100} onQtd={setText('horasExtras100')} onValor={(value) => updateParam('valorHora100', value)} />
            <HourRow label="Hora extra 150%" qtd={params.horasExtras150} valor={params.valorHora150} onQtd={setText('horasExtras150')} onValor={(value) => updateParam('valorHora150', value)} />
            <HourRow label="Domingo" qtd={params.horasExtrasDomingo} valor={params.valorHoraDomingo} onQtd={setText('horasExtrasDomingo')} onValor={(value) => updateParam('valorHoraDomingo', value)} />
            <HourRow label="Feriado" qtd={params.horasExtrasFeriado} valor={params.valorHoraFeriado} onQtd={setText('horasExtrasFeriado')} onValor={(value) => updateParam('valorHoraFeriado', value)} />
          </div>
        </section>

        <section className="calc-form-card folha-card">
          <h3><HeartPulse size={18} color="#c59235" />Benefícios e Descontos</h3>
          <label className="folha-check">
            <input type="checkbox" checked={params.valeTransporteAtivo} onChange={(event) => updateParam('valeTransporteAtivo', event.target.checked)} />
            Vale transporte
          </label>
          <div className="folha-grid two">
            <MoneyField label="VT valor mensal" value={params.valorValeTransporte} onChange={(value) => updateParam('valorValeTransporte', value)} />
            <MoneyField label="Vale alimentação empresa" value={params.valeAlimentacaoEmpresa} onChange={(value) => updateParam('valeAlimentacaoEmpresa', value)} />
            <MoneyField label="Vale alimentação funcionário" value={params.valeAlimentacaoDesconto} onChange={(value) => updateParam('valeAlimentacaoDesconto', value)} />
            <MoneyField label="Plano de saúde empresa" value={params.planoSaudeEmpresa} onChange={(value) => updateParam('planoSaudeEmpresa', value)} />
            <MoneyField label="Plano de saúde funcionário" value={params.planoSaudeDesconto} onChange={(value) => updateParam('planoSaudeDesconto', value)} />
            <MoneyField label="Odontológico empresa" value={params.odontologicoEmpresa} onChange={(value) => updateParam('odontologicoEmpresa', value)} />
            <MoneyField label="Odontológico funcionário" value={params.odontologicoDesconto} onChange={(value) => updateParam('odontologicoDesconto', value)} />
            <MoneyField label="Pensão alimentícia" value={params.pensaoAlimenticia} onChange={(value) => updateParam('pensaoAlimenticia', value)} />
          </div>
        </section>

        <section className="calc-form-card folha-card">
          <h3><FileText size={18} color="#c59235" />Ajustes Manuais</h3>
          <div className="folha-grid two">
            <NumberField label="Dias faltados" value={params.faltasDias} onChange={setText('faltasDias')} />
            <NumberField label="Atestados" value={params.atestadosDias} onChange={setText('atestadosDias')} />
            <div className="calc-field">
              <label>Descrição do desconto</label>
              <input value={params.descontoManualDescricao} onChange={setText('descontoManualDescricao')} placeholder="Ex.: adiantamento" />
            </div>
            <MoneyField label="Desconto adicional" value={params.descontoManualValor} onChange={(value) => updateParam('descontoManualValor', value)} />
            <div className="calc-field">
              <label>Descrição do adicional</label>
              <input value={params.adicionalManualDescricao} onChange={setText('adicionalManualDescricao')} placeholder="Ex.: prêmio" />
            </div>
            <MoneyField label="Adicional manual" value={params.adicionalManualValor} onChange={(value) => updateParam('adicionalManualValor', value)} />
          </div>
        </section>
      </div>

      <aside className="folha-results-stack">
        <section className="resultado-card folha-result-card">
          <h3><Calculator size={18} color="#c59235" />Resumo</h3>
          <SummaryRow label="Salário Bruto" value={resultado.salarioBruto} />
          {resultado.adicionalTempoServico > 0 && (
            <SummaryRow label="Adic. tempo serviço" value={resultado.adicionalTempoServico} tone="blue" />
          )}
          <SummaryRow label="Descontos Funcionário" value={resultado.descontosFuncionario} tone="danger" />
          <SummaryRow label="Encargos Empresa" value={resultado.encargosEmpresa} tone="blue" />
          <SummaryRow label="Custo Total" value={resultado.custoEmpregador} tone="strong" />
        </section>

        <section className="resultado-card folha-result-card">
          <h3><BarChart3 size={18} color="#c59235" />Resultado do Cálculo</h3>
          <ResultRow label="INSS" value={resultado.inss} tone="danger" info={['Cálculo progressivo por faixas.', 'Até R$ 1.518,00: 7,5%.', 'Faixas seguintes: 9%, 12% e 14%.']} />
          <ResultRow label="Base de Cálculo IRRF" value={resultado.baseIRRF} />
          <ResultRow label="IRRF" value={resultado.irrf} tone="danger" info={[`Faixa aplicada: ${resultado.detalhamento.faixaIrrfLabel}.`, 'Deduz INSS, dependentes e pensão informada.']} />
          <ResultRow label="FGTS" value={resultado.fgts} tone="blue" info={[`Alíquota simulada: ${formatPercent(resultado.detalhamento.fgtsPercentual)}.`, 'Aprendiz usa percentual reduzido; pró-labore e estágio não geram FGTS.']} />
          <ResultRow label="Salário Família" value={resultado.salarioFamilia} />
          <ResultRow label="Salário Líquido" value={resultado.salarioLiquido} tone="success" highlight />
        </section>

        <section className="resultado-card folha-result-card">
          <h3><MapPin size={18} color="#c59235" />Encargos e Benefícios</h3>
          <ResultRow label="Encargos previdenciários/SAT/FAP" value={resultado.encargosPrevidenciarios} info={[`Região: ${resultado.detalhamento.regiaoLabel}.`, `Percentual simulado: ${formatPercent(resultado.detalhamento.encargosPercentual)}.`]} />
          <ResultRow label="Benefícios pagos pela empresa" value={resultado.beneficiosEmpresa} />
          <ResultRow label="VT descontado funcionário" value={resultado.valeTransporteDesconto} tone="danger" />
          <ResultRow label="Faltas descontadas" value={resultado.faltas} tone="danger" />
          <ResultRow label="Atestados abonados" value={resultado.detalhamento.atestadosAbonados} rawValue={`${resultado.detalhamento.atestadosAbonados} dia(s)`} />
        </section>

        <section className="resultado-card folha-result-card">
          <h3><TrendingUp size={18} color="#c59235" />Comparação e Aumento</h3>
          <div className="folha-grid two compact">
            <MoneyField label="Comparar salário" value={params.salarioComparacao} onChange={(value) => updateParam('salarioComparacao', value)} />
            <PercentField label="Simular aumento" value={params.aumentoPercentual} onChange={setText('aumentoPercentual')} />
          </div>
          {resultado.comparacao && (
            <div className="folha-compare-box">
              <span>{formatCurrency(resultado.salarioBruto)} → {formatCurrency(resultado.comparacao.salario)}</span>
              <strong>{formatCurrency(resultado.comparacao.diferencaCusto)} no custo</strong>
              <small>INSS {formatCurrency(resultado.comparacao.inss)} · IRRF {formatCurrency(resultado.comparacao.irrf)} · FGTS {formatCurrency(resultado.comparacao.fgts)}</small>
            </div>
          )}
          {resultado.aumento && (
            <div className="folha-compare-box muted">
              <span>Novo salário: {formatCurrency(resultado.aumento.novoSalario)}</span>
              <strong>{formatCurrency(resultado.aumento.diferencaMensal)} por mês</strong>
              <small>{formatCurrency(resultado.aumento.diferencaAnual)} por ano</small>
            </div>
          )}
        </section>

        <section className="resultado-card folha-result-card">
          <h3><BarChart3 size={18} color="#c59235" />Distribuição</h3>
          <GraphBar label="Bruto" value={resultado.salarioBruto} max={resultado.custoEmpregador} />
          <GraphBar label="INSS" value={resultado.inss} max={resultado.custoEmpregador} tone="danger" />
          <GraphBar label="IRRF" value={resultado.irrf} max={resultado.custoEmpregador} tone="danger" />
          <GraphBar label="Líquido" value={resultado.salarioLiquido} max={resultado.custoEmpregador} tone="success" />
        </section>
      </aside>
    </div>
  );
};

const MoneyField: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <div className="calc-field">
    <label>{label}</label>
    <CurrencyInput value={value} onValueChange={onChange} />
  </div>
);

const PercentField: React.FC<{ label: string; value: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, value, onChange }) => (
  <div className="calc-field">
    <label>{label} (%)</label>
    <input type="number" value={value} onChange={onChange} min={0} step="0.1" />
  </div>
);

const NumberField: React.FC<{ label: string; value: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, value, onChange }) => (
  <div className="calc-field">
    <label>{label}</label>
    <input type="number" value={value} onChange={onChange} min={0} />
  </div>
);

const HourRow: React.FC<{ label: string; qtd: string; valor: string; onQtd: (event: React.ChangeEvent<HTMLInputElement>) => void; onValor: (value: string) => void }> = ({
  label,
  qtd,
  valor,
  onQtd,
  onValor,
}) => (
  <div className="folha-hour-row">
    <span>{label}</span>
    <input type="number" value={qtd} onChange={onQtd} min={0} placeholder="Qtd." />
    <CurrencyInput value={valor} onValueChange={onValor} aria-label={`Valor da ${label}`} />
  </div>
);

const SummaryRow: React.FC<{ label: string; value: number; tone?: 'danger' | 'blue' | 'strong' }> = ({ label, value, tone }) => (
  <div className={`folha-summary-row ${tone ?? ''}`}>
    <span>{label}</span>
    <strong>{formatCurrency(value)}</strong>
  </div>
);

const ResultRow: React.FC<{ label: string; value: number; rawValue?: string; tone?: 'danger' | 'blue' | 'success'; highlight?: boolean; info?: string[] }> = ({
  label,
  value,
  rawValue,
  tone,
  highlight,
  info,
}) => (
  <div className={`resultado-row ${tone ?? ''}${highlight ? ' destaque' : ''}`}>
    <span className="r-label">{info ? <InfoLabel label={label} items={info} /> : label}</span>
    <span className="r-valor">{rawValue ?? formatCurrency(value)}</span>
  </div>
);

const InfoLabel: React.FC<{ label: string; items: string[] }> = ({ label, items }) => (
  <span className="folha-info-label">
    {label}
    <span className="folha-info-icon" tabIndex={0}><Info size={13} /></span>
    <span className="folha-tooltip">
      {items.map((item) => <span key={item}>{item}</span>)}
    </span>
  </span>
);

const GraphBar: React.FC<{ label: string; value: number; max: number; tone?: 'danger' | 'success' }> = ({ label, value, max, tone }) => (
  <div className={`folha-graph-row ${tone ?? ''}`}>
    <span>{label}</span>
    <div><i style={{ width: `${Math.max(4, (value / Math.max(max, 1)) * 100)}%` }} /></div>
    <strong>{formatCurrency(value)}</strong>
  </div>
);
