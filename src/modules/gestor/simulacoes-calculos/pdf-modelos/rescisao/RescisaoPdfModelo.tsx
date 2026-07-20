import React from 'react';
import { parseCurrencyInputValue } from '../../../shared/currencyInputUtils';
import { formatCurrency, type ResultadoRescisao } from '../../services/calculos.service';
import type { AdicionalTempoServicoTipo, AvisoPrevioModo } from '../../hooks/useSimulacoesCalculos';

interface RescisaoPdfParams {
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
  params: RescisaoPdfParams;
  resultado: ResultadoRescisao;
}

const tipoRescisaoLabels: Record<string, string> = {
  sem_justa_causa: 'Sem justa causa',
  com_justa_causa: 'Com justa causa',
  pedido_demissao: 'Pedido de demissão',
};

const avisoPrevioLabels: Record<AvisoPrevioModo, string> = {
  cumprido: 'Cumprido',
  descontado: 'Não cumprido / descontado',
  indenizado: 'Indenizado',
};

const adicionalTempoLabels: Record<AdicionalTempoServicoTipo, string> = {
  trienio: 'Triênio',
  quinquenio: 'Quinquênio',
  manual: 'Valor manual',
};

const sectionTitleStyle: React.CSSProperties = {
  color: '#1e293b',
  fontSize: '0.82rem',
  fontWeight: 900,
  letterSpacing: '0.02em',
  margin: 0,
  textTransform: 'uppercase',
};

const rowBorder = '1px solid #eef2f7';

const formatDate = (date: string) => {
  if (!date) return 'Não informado';
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
};

const valueOrDash = (value: number) => value > 0 ? formatCurrency(value) : '-';

const PdfSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <h4 style={sectionTitleStyle}>{title}</h4>
    {children}
  </section>
);

const InfoGrid: React.FC<{ rows: Array<[string, React.ReactNode]> }> = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
    {rows.map(([label, value]) => (
      <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: '9px', padding: '9px 10px', background: '#fcfcfd' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.56rem', fontWeight: 900, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ color: '#0f172a', fontSize: '0.72rem', fontWeight: 800, marginTop: '3px' }}>{value}</div>
      </div>
    ))}
  </div>
);

const DemonstrativoRow: React.FC<{
  label: string;
  provento?: number;
  desconto?: number;
  destaque?: 'blue' | 'danger' | 'gold';
}> = ({ label, provento = 0, desconto = 0, destaque }) => {
  const valueColor = destaque === 'danger' ? '#ef4444' : destaque === 'blue' ? '#3b82f6' : destaque === 'gold' ? '#c59235' : '#0f172a';

  return (
    <tr style={{ borderBottom: rowBorder }}>
      <td style={{ padding: '7px 8px', color: '#475569', fontWeight: 700 }}>{label}</td>
      <td style={{ padding: '7px 8px', color: valueColor, fontWeight: 800, textAlign: 'right' }}>{valueOrDash(provento)}</td>
      <td style={{ padding: '7px 8px', color: desconto > 0 ? '#ef4444' : '#94a3b8', fontWeight: 800, textAlign: 'right' }}>{valueOrDash(desconto)}</td>
    </tr>
  );
};

export const RescisaoPdfModelo: React.FC<Props> = ({ params, resultado }) => {
  const salarioInformado = parseCurrencyInputValue(params.salario);
  const saldoFgts = parseCurrencyInputValue(params.saldoFGTS);
  const periodosVencidos = Number(params.feriasVencidasPeriodos || 0);
  const adicionalTempoDescricao = params.adicionalTempoServicoAtivo
    ? params.adicionalTempoServicoTipo === 'manual'
      ? `${adicionalTempoLabels[params.adicionalTempoServicoTipo]}: ${formatCurrency(parseCurrencyInputValue(params.adicionalTempoServicoValor))}`
      : `${adicionalTempoLabels[params.adicionalTempoServicoTipo]}: ${params.adicionalTempoServicoPercentual || '0'}% por período`
    : 'Não aplicado';
  const feriasVencidasDescricao = `${periodosVencidos} período(s)${params.feriasVencidasEmDobro ? ' com pagamento em dobro' : ''}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#0f172a' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr', gap: '10px' }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '13px 14px', background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase' }}>Líquido das verbas do TRCT</div>
          <div style={{ color: '#10b981', fontSize: '1.18rem', fontWeight: 950, marginTop: '4px' }}>{formatCurrency(resultado.totalLiquido)}</div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '13px 14px', background: '#fff' }}>
          <div style={{ color: '#64748b', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase' }}>Total bruto</div>
          <div style={{ color: '#0f172a', fontSize: '0.94rem', fontWeight: 900, marginTop: '5px' }}>{formatCurrency(resultado.totalBruto)}</div>
        </div>
        <div style={{ border: '1px solid #fee2e2', borderRadius: '12px', padding: '13px 14px', background: '#fffafa' }}>
          <div style={{ color: '#991b1b', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase' }}>Descontos</div>
          <div style={{ color: '#ef4444', fontSize: '0.94rem', fontWeight: 900, marginTop: '5px' }}>{formatCurrency(resultado.totalDescontos)}</div>
        </div>
      </div>

      <PdfSection title="Parâmetros informados">
        <InfoGrid
          rows={[
            ['Motivo da rescisão', tipoRescisaoLabels[params.tipo] || params.tipo.replaceAll('_', ' ')],
            ['Aviso prévio', avisoPrevioLabels[params.avisoPrevioModo]],
            ['Admissão', formatDate(params.dataAdmissao)],
            ['Desligamento', formatDate(params.dataDemissao)],
            ['Salário informado', formatCurrency(salarioInformado)],
            ['Base de cálculo', formatCurrency(resultado.salarioBaseCalculo)],
            ['Saldo FGTS informado', formatCurrency(saldoFgts)],
            ['Férias vencidas', feriasVencidasDescricao],
            ['Adicional tempo serviço', adicionalTempoDescricao],
          ]}
        />
      </PdfSection>

      <PdfSection title="Demonstrativo das verbas">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', overflow: 'hidden', borderRadius: '10px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px', color: '#475569', fontWeight: 900, textAlign: 'left' }}>Rubrica</th>
              <th style={{ padding: '8px', color: '#475569', fontWeight: 900, textAlign: 'right' }}>Proventos</th>
              <th style={{ padding: '8px', color: '#475569', fontWeight: 900, textAlign: 'right' }}>Descontos</th>
            </tr>
          </thead>
          <tbody>
            {resultado.adicionalTempoServico > 0 && (
              <DemonstrativoRow label="Adicional tempo serviço" provento={resultado.adicionalTempoServico} />
            )}
            <DemonstrativoRow label="Saldo de salário" provento={resultado.saldoSalario} />
            <DemonstrativoRow label="13º salário proporcional" provento={resultado.decimoTerceiroProporcional} />
            <DemonstrativoRow label="Férias proporcionais" provento={resultado.feriasProporcionais} />
            <DemonstrativoRow label="1/3 sobre férias proporcionais" provento={resultado.adicionalFerias} />
            <DemonstrativoRow label="Férias vencidas" provento={resultado.feriasVencidas} />
            <DemonstrativoRow label="1/3 sobre férias vencidas" provento={resultado.adicionalFeriasVencidas} />
            <DemonstrativoRow label="Aviso prévio indenizado" provento={resultado.avisoPrevio} />
            <DemonstrativoRow label="Multa FGTS (conta vinculada)" provento={resultado.multaFGTS} destaque="blue" />
            <DemonstrativoRow label="INSS estimado" desconto={resultado.inssRescisao} destaque="danger" />
            <DemonstrativoRow label="IRRF estimado" desconto={resultado.irrfRescisao} destaque="danger" />
            <DemonstrativoRow label="Aviso prévio descontado" desconto={resultado.avisoPrevioDesconto} destaque="danger" />
          </tbody>
        </table>
      </PdfSection>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fcfcfd' }}>
          <h4 style={{ ...sectionTitleStyle, marginBottom: '8px' }}>Memória de cálculo</h4>
          <ul style={{ margin: 0, paddingLeft: '16px', color: '#475569', fontSize: '0.66rem', lineHeight: 1.55, fontWeight: 600 }}>
            <li>Saldo de salário: base remuneratória dividida por 30 e multiplicada pelos dias do mês do desligamento.</li>
            <li>13º proporcional: cada mês ou fração com pelo menos 15 dias, incluindo a projeção legal do aviso indenizado.</li>
            <li>Férias proporcionais e vencidas recebem acréscimo de 1/3 constitucional.</li>
            <li>Multa FGTS: 40% sobre o saldo informado acrescido dos depósitos rescisórios estimados.</li>
            <li>A multa do FGTS vai para a conta vinculada e não integra o líquido das verbas do TRCT.</li>
          </ul>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#fcfcfd' }}>
          <h4 style={{ ...sectionTitleStyle, marginBottom: '8px' }}>Pontos de conferência</h4>
          <ul style={{ margin: 0, paddingLeft: '16px', color: '#475569', fontSize: '0.66rem', lineHeight: 1.55, fontWeight: 600 }}>
            <li>Validar médias de horas extras, adicionais variáveis, comissões e afastamentos.</li>
            <li>Confirmar CCT/ACT para triênio, quinquênio e regras sindicais específicas.</li>
            <li>Conferir férias vencidas, dobra legal e saldos oficiais antes da emissão do TRCT.</li>
            <li>Usar este PDF como apoio gerencial, não como documento rescisório oficial.</li>
          </ul>
        </div>
      </div>

      <div style={{ border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: '12px', padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: '#1e3a8a', fontSize: '0.72rem', fontWeight: 900 }}>Líquido estimado das verbas do TRCT</span>
          <span style={{ color: '#10b981', fontSize: '1.16rem', fontWeight: 950 }}>{formatCurrency(resultado.totalLiquido)}</span>
        </div>
      </div>

      <div style={{ color: '#64748b', fontSize: '0.58rem', lineHeight: 1.45, fontWeight: 500 }}>
        <strong style={{ color: '#475569', fontWeight: 800 }}>SIMULAÇÃO GERENCIAL</strong><br />
        Este relatório apresenta uma estimativa das verbas rescisórias com base nos dados informados. O resultado pode sofrer variações por convenção coletiva, médias variáveis, faltas, eventos específicos, tabelas vigentes e conferência final do fechamento trabalhista.
      </div>
    </div>
  );
};
