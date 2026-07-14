import React from 'react';
import { parseCurrencyInputValue } from '../../../shared/currencyInputUtils';
import {
  formatCurrency,
  formatPercent,
  type ResultadoDAS,
  type ResultadoFolha,
  type ResultadoMulta,
  type ResultadoPisCofins,
  type ResultadoProLabore,
} from '../../services/calculos.service';
import type {
  ResultadoComparativoRegime,
  ResultadoContratacao,
  ResultadoCustos,
  ResultadoEncargos,
  ResultadoFerias,
  ResultadoSimulacaoImposto,
  ResultadoTempoEmpresa,
} from '../../services/calculosNovas.service';

type PdfRow = [string, React.ReactNode];
type MoneyRow = [string, number, ('normal' | 'good' | 'bad' | 'info')?];

const sectionTitleStyle: React.CSSProperties = {
  color: '#1e293b',
  fontSize: '0.82rem',
  fontWeight: 900,
  letterSpacing: '0.02em',
  margin: 0,
  textTransform: 'uppercase',
};

const formatDate = (date: string) => {
  if (!date) return 'Não informado';
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
};

const valueColor = (tone: MoneyRow[2]) => {
  if (tone === 'good') return '#10b981';
  if (tone === 'bad') return '#ef4444';
  if (tone === 'info') return '#3b82f6';
  return '#0f172a';
};

const PdfSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <h4 style={sectionTitleStyle}>{title}</h4>
    {children}
  </section>
);

const InfoGrid: React.FC<{ rows: PdfRow[] }> = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
    {rows.map(([label, value]) => (
      <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: '9px', padding: '9px 10px', background: '#fcfcfd' }}>
        <div style={{ color: '#94a3b8', fontSize: '0.56rem', fontWeight: 900, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ color: '#0f172a', fontSize: '0.72rem', fontWeight: 800, marginTop: '3px' }}>{value}</div>
      </div>
    ))}
  </div>
);

const SummaryCards: React.FC<{ rows: MoneyRow[] }> = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(rows.length, 3)}, minmax(0, 1fr))`, gap: '10px' }}>
    {rows.map(([label, value, tone]) => (
      <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '13px 14px', background: tone === 'bad' ? '#fffafa' : '#f8fafc' }}>
        <div style={{ color: '#64748b', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ color: valueColor(tone), fontSize: '1rem', fontWeight: 950, marginTop: '5px' }}>{formatCurrency(value)}</div>
      </div>
    ))}
  </div>
);

const MoneyTable: React.FC<{ rows: MoneyRow[] }> = ({ rows }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
    <tbody>
      {rows.map(([label, value, tone]) => (
        <tr key={label} style={{ borderBottom: '1px solid #eef2f7' }}>
          <th style={{ padding: '7px 0', color: '#475569', fontWeight: 700, textAlign: 'left' }}>{label}</th>
          <td style={{ padding: '7px 0', color: valueColor(tone), fontWeight: 850, textAlign: 'right' }}>{formatCurrency(value)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const SimulationNotice: React.FC = () => (
  <div style={{ color: '#64748b', fontSize: '0.58rem', lineHeight: 1.45, fontWeight: 500 }}>
    <strong style={{ color: '#475569', fontWeight: 800 }}>SIMULAÇÃO GERENCIAL</strong><br />
    Este relatório apresenta uma estimativa com base nos dados informados e parâmetros atuais do sistema. O resultado pode sofrer variações por regras legais, convenções, documentos oficiais, arredondamentos, alterações de tabela e conferência final do responsável técnico.
  </div>
);

const PdfModel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#0f172a' }}>
    {children}
    <SimulationNotice />
  </div>
);

export const FolhaPdfModelo: React.FC<{ params: any; resultado: ResultadoFolha }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['Salário líquido', resultado.salarioLiquido, 'good'],
      ['Descontos funcionário', resultado.descontosFuncionario, 'bad'],
      ['Custo empregador', resultado.custoEmpregador, 'info'],
    ]} />
    <PdfSection title="Parâmetros da folha">
      <InfoGrid rows={[
        ['Tipo de funcionário', resultado.detalhamento.tipoFuncionarioLabel],
        ['Competência', params.competencia],
        ['Região', resultado.detalhamento.regiaoLabel],
        ['Dependentes', params.dependentes],
        ['Salário informado', formatCurrency(parseCurrencyInputValue(params.salarioBruto))],
        ['Faixa IRRF', resultado.detalhamento.faixaIrrfLabel],
      ]} />
    </PdfSection>
    <PdfSection title="Proventos, descontos e encargos">
      <MoneyTable rows={[
        ['Base remuneratória', resultado.salarioBruto],
        ['Horas extras', resultado.horasExtrasTotal],
        ['Adicional noturno', resultado.adicionalNoturno],
        ['Insalubridade', resultado.insalubridade],
        ['Adicional tempo serviço', resultado.adicionalTempoServico],
        ['Salário família', resultado.salarioFamilia, 'good'],
        ['INSS', resultado.inss, 'bad'],
        ['IRRF', resultado.irrf, 'bad'],
        ['FGTS', resultado.fgts, 'info'],
        ['Benefícios empresa', resultado.beneficiosEmpresa, 'info'],
        ['Encargos previdenciários/SAT/FAP', resultado.encargosPrevidenciarios, 'info'],
      ]} />
    </PdfSection>
  </PdfModel>
);

export const ProLaborePdfModelo: React.FC<{ valor: string; resultado: ResultadoProLabore }> = ({ valor, resultado }) => {
  return (
    <PdfModel>
      <SummaryCards rows={[
        ['Pró-labore bruto', resultado.valorProLabore],
        ['Líquido do sócio', resultado.liquido, 'good'],
        ['Custo estimado empresa', resultado.custoEmpresa, 'info'],
      ]} />
      <PdfSection title="Base e retenções">
        <InfoGrid rows={[
          ['Valor informado', formatCurrency(parseCurrencyInputValue(valor))],
          ['Critério', 'Sócio-administrador / pró-labore'],
        ]} />
        <MoneyTable rows={[
          ['INSS retido', resultado.inss, 'bad'],
          ['IRRF retido', resultado.irrf, 'bad'],
          ['CPP estimada', resultado.cpp, 'info'],
        ]} />
      </PdfSection>
    </PdfModel>
  );
};

export const FeriasPdfModelo: React.FC<{ params: any; resultado: ResultadoFerias }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['Total líquido', resultado.totalLiquido, 'good'],
      ['Total bruto', resultado.totalBruto],
      ['Custo empresa', resultado.custoEmpresa, 'info'],
    ]} />
    <PdfSection title="Parâmetros de férias">
      <InfoGrid rows={[
        ['Salário base', formatCurrency(parseCurrencyInputValue(params.salarioBruto))],
        ['Dias de férias', `${params.diasFerias} dias`],
        ['Dependentes', params.dependentes],
        ['Abono pecuniário', params.abonoPecuniario ? 'Sim' : 'Não'],
        ['Adiantamento 13º', params.adiantamento13 ? 'Sim' : 'Não'],
      ]} />
    </PdfSection>
    <PdfSection title="Demonstrativo">
      <MoneyTable rows={[
        ['Valor das férias', resultado.valorFerias],
        ['1/3 constitucional', resultado.tercoConstitucional],
        ['Abono pecuniário', resultado.abonoPecuniario],
        ['1/3 sobre abono', resultado.tercoAbono],
        ['Adiantamento 13º', resultado.adiantamento13],
        ['INSS férias', resultado.inss, 'bad'],
        ['IRRF férias', resultado.irrf, 'bad'],
      ]} />
    </PdfSection>
  </PdfModel>
);

export const TempoEmpresaPdfModelo: React.FC<{ params: any; resultado: ResultadoTempoEmpresa }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['Custo acumulado', resultado.custoTotalAcumulado, 'info'],
      ['FGTS acumulado', resultado.fgtsAcumulado],
      ['Multa FGTS projetada', resultado.multaFgtsProjetada, 'bad'],
    ]} />
    <PdfSection title="Período do vínculo">
      <InfoGrid rows={[
        ['Admissão', formatDate(params.dataAdmissao)],
        ['Data referência', formatDate(params.dataReferencia)],
        ['Salário base', formatCurrency(parseCurrencyInputValue(params.salarioBase))],
        ['Tempo apurado', `${resultado.anos} anos, ${resultado.meses} meses e ${resultado.dias} dias`],
      ]} />
    </PdfSection>
    <PdfSection title="Provisões estimadas">
      <MoneyTable rows={[
        ['Provisão 13º', resultado.provisao13],
        ['Provisão férias', resultado.provisaoFerias],
        ['1/3 férias provisionado', resultado.provisaoTerco],
        ['FGTS acumulado', resultado.fgtsAcumulado],
        ['Multa FGTS projetada', resultado.multaFgtsProjetada, 'bad'],
      ]} />
    </PdfSection>
  </PdfModel>
);

export const EncargosPdfModelo: React.FC<{ params: any; resultado: ResultadoEncargos }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['Total encargos', resultado.totalEncargosValor, 'info'],
      ['Salário base', parseCurrencyInputValue(params.salarioBruto)],
      ['Custo total mensal', parseCurrencyInputValue(params.salarioBruto) + resultado.totalEncargosValor, 'bad'],
    ]} />
    <PdfSection title="Parâmetros patronais">
      <InfoGrid rows={[
        ['Regime', params.regimeEmpresa],
        ['RAT', `${params.rat}%`],
        ['FAP', params.fap],
        ['Terceiros', `${params.terceiros}%`],
      ]} />
    </PdfSection>
    <PdfSection title="Composição dos encargos">
      <MoneyTable rows={[
        ['INSS patronal', resultado.inssPatronal],
        ['RAT ajustado', resultado.ratAjustado],
        ['Terceiros', resultado.terceirosValor],
        ['FGTS', resultado.fgts],
        ['Provisão férias/13º', resultado.provisaoFerias13],
      ]} />
    </PdfSection>
  </PdfModel>
);

export const ContratacaoPdfModelo: React.FC<{ params: any; resultado: ResultadoContratacao }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['Custo CLT mensal', resultado.custoCltMensal, 'bad'],
      ['Custo PJ mensal', resultado.custoPjMensal, 'info'],
      ['Custo estágio mensal', resultado.custoEstagioMensal, 'info'],
    ]} />
    <PdfSection title="Parâmetros comparados">
      <InfoGrid rows={[
        ['Salário / bolsa / contrato', formatCurrency(parseCurrencyInputValue(params.salarioProposto))],
        ['Vale transporte', formatCurrency(parseCurrencyInputValue(params.valeTransporte))],
        ['Vale alimentação', formatCurrency(parseCurrencyInputValue(params.valeAlimentacao))],
        ['Plano de saúde', formatCurrency(parseCurrencyInputValue(params.planoSaude))],
      ]} />
    </PdfSection>
    <PdfSection title="Comparativo mensal e anual">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
        <tbody>
          {[
            ['CLT', resultado.custoCltMensal, resultado.custoCltAnual, resultado.liquidoClt],
            ['PJ', resultado.custoPjMensal, resultado.custoPjAnual, resultado.liquidoPj],
            ['Estágio', resultado.custoEstagioMensal, resultado.custoEstagioAnual, resultado.liquidoEstagio],
          ].map(([label, mensal, anual, liquido]) => (
            <tr key={String(label)} style={{ borderBottom: '1px solid #eef2f7' }}>
              <th style={{ padding: '7px 0', textAlign: 'left', color: '#475569' }}>{label}</th>
              <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 800 }}>{formatCurrency(Number(mensal))}</td>
              <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 800 }}>{formatCurrency(Number(anual))}</td>
              <td style={{ padding: '7px 0', textAlign: 'right', color: '#10b981', fontWeight: 800 }}>{formatCurrency(Number(liquido))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PdfSection>
  </PdfModel>
);

export const DasPdfModelo: React.FC<{ params: any; resultado: ResultadoDAS }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['DAS estimado', resultado.valorDAS, 'bad'],
      ['Faturamento mês', parseCurrencyInputValue(params.faturamentoMensal)],
      ['RBT12', resultado.faturamento12Meses],
    ]} />
    <PdfSection title="Simples Nacional">
      <InfoGrid rows={[
        ['Anexo', `Anexo ${params.anexo}`],
        ['Faixa', `${resultado.faixaNumero}ª faixa`],
        ['Alíquota nominal', formatPercent(resultado.aliquotaNominal)],
        ['Alíquota efetiva', formatPercent(resultado.aliquotaEfetiva)],
        ['Parcela a deduzir', formatCurrency(resultado.valorDeduzir)],
      ]} />
    </PdfSection>
  </PdfModel>
);

export const PisCofinsPdfModelo: React.FC<{ params: any; resultado: ResultadoPisCofins }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['Total a recolher', resultado.totalPagar, 'bad'],
      ['Faturamento', resultado.faturamento],
      ['Créditos apurados', resultado.creditosApurados, 'good'],
    ]} />
    <PdfSection title="Apuração PIS/COFINS">
      <InfoGrid rows={[
        ['Regime', params.regime],
        ['Créditos entrada', formatCurrency(parseCurrencyInputValue(params.creditosEntrada))],
      ]} />
      <MoneyTable rows={[
        ['Débito PIS', resultado.debitoPIS, 'bad'],
        ['Débito COFINS', resultado.debitoCOFINS, 'bad'],
        ['Saldo PIS', resultado.saldoPIS, 'bad'],
        ['Saldo COFINS', resultado.saldoCOFINS, 'bad'],
      ]} />
    </PdfSection>
  </PdfModel>
);

export const MultasPdfModelo: React.FC<{ params: any; resultado: ResultadoMulta }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['Total a pagar', resultado.totalPagar, 'bad'],
      ['Valor original', resultado.valorOriginal],
      ['Acréscimos', resultado.multaValor + resultado.jurosValor, 'bad'],
    ]} />
    <PdfSection title="Parâmetros do atraso">
      <InfoGrid rows={[
        ['Vencimento', formatDate(params.dataVencimento)],
        ['Pagamento', formatDate(params.dataPagamento)],
        ['Multa aplicada', formatPercent(resultado.multaPercentual)],
        ['Juros Selic', formatPercent(resultado.jurosPercentual)],
      ]} />
      <MoneyTable rows={[
        ['Multa', resultado.multaValor, 'bad'],
        ['Juros', resultado.jurosValor, 'bad'],
      ]} />
    </PdfSection>
  </PdfModel>
);

export const ComparativoRegimePdfModelo: React.FC<{ params: any; resultado: ResultadoComparativoRegime }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['Simples Nacional', resultado.simplesNacional],
      ['Lucro Presumido', resultado.lucroPresumido],
      ['Lucro Real', resultado.lucroReal],
    ]} />
    <PdfSection title="Cenário tributário">
      <InfoGrid rows={[
        ['Faturamento anual', formatCurrency(parseCurrencyInputValue(params.faturamentoAnual))],
        ['Compras/insumos', formatCurrency(parseCurrencyInputValue(params.comprasInsumosAnual))],
        ['Folha anual', formatCurrency(parseCurrencyInputValue(params.folhaAnual))],
        ['Margem lucro', `${params.margemLucro}%`],
        ['Melhor opção', resultado.melhorOpcao],
      ]} />
      <p style={{ margin: 0, color: '#475569', fontSize: '0.7rem', lineHeight: 1.5, fontWeight: 650 }}>{resultado.melhorOpcaoDesc}</p>
      {(resultado.alertas || []).map((alerta) => (
        <p key={alerta} style={{ margin: 0, color: '#92400e', fontSize: '0.66rem', lineHeight: 1.45, fontWeight: 650 }}>{alerta}</p>
      ))}
    </PdfSection>
  </PdfModel>
);

export const SimulacaoImpostoPdfModelo: React.FC<{ params: any; resultado: ResultadoSimulacaoImposto }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['Imposto total', resultado.impostoTotal, 'bad'],
      ['Faturamento mensal', parseCurrencyInputValue(params.faturamentoMensal)],
      ['Faturamento líquido', parseCurrencyInputValue(params.faturamentoMensal) - resultado.impostoTotal, 'good'],
    ]} />
    <PdfSection title="Detalhamento por tributo">
      <InfoGrid rows={[
        ['Atividade', params.tipoAtividade],
        ['Alíquota estimada', `${params.aliquotaEstimada}%`],
      ]} />
      <MoneyTable rows={resultado.detalheImpostos.map((item) => [`${item.nome} (${item.percentual.toFixed(2)}%)`, item.valor, 'bad'])} />
    </PdfSection>
  </PdfModel>
);

export const CustosPdfModelo: React.FC<{ params: any; resultado: ResultadoCustos }> = ({ params, resultado }) => (
  <PdfModel>
    <SummaryCards rows={[
      ['Ponto equilíbrio', resultado.pontoEquilibrio, 'bad'],
      ['Faturamento alvo', resultado.faturamentoAlvo, 'info'],
      ['Lucro estimado', resultado.lucroEstimado, 'good'],
    ]} />
    <PdfSection title="Parâmetros operacionais">
      <InfoGrid rows={[
        ['Custos fixos', formatCurrency(parseCurrencyInputValue(params.custosFixos))],
        ['Custos variáveis', `${params.custosVariaveisPercentual}%`],
        ['Markup desejado', `${params.markupDesejado}%`],
        ['Margem contribuição', `${resultado.margemContribuicaoPercentual.toFixed(2)}%`],
      ]} />
    </PdfSection>
  </PdfModel>
);
