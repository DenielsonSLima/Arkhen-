import { parseCurrencyInputValue } from '../../shared/currencyInputUtils';
import { formatCurrency, formatPercent } from '../services/calculos.service';
import type { AbaCalculo } from '../hooks/useSimulacoesCalculos';
import type { SimulationPdfSection } from './simulationPdfTypes';

type PdfData = Record<string, any>;

const moneyInput = (value: string) => formatCurrency(parseCurrencyInputValue(value));
const dateBr = (value: string) => {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : value || 'Não informado';
};
const yesNo = (value: boolean) => value ? 'Sim' : 'Não';
const row = (label: string, value: unknown) => ({ label, value: String(value ?? '—') });
const moneyRow = (label: string, value: number) => row(label, formatCurrency(value || 0));
const section = (title: string, rows: SimulationPdfSection['rows']): SimulationPdfSection => ({ title, rows });

export const buildLegacyPdfSections = (abaAtiva: AbaCalculo, data: PdfData): SimulationPdfSection[] => {
  const p = data.params;
  const r = data.resultado;

  switch (abaAtiva) {
    case 'folha':
      return [
        section('Dados informados', [
          row('Tipo de funcionário', r.detalhamento.tipoFuncionarioLabel),
          row('Competência', p.competencia),
          row('Região', r.detalhamento.regiaoLabel),
          row('Dependentes', p.dependentes),
          row('Salário bruto', moneyInput(p.salarioBruto)),
          row('Faixa de IRRF', r.detalhamento.faixaIrrfLabel),
        ]),
        section('Proventos, descontos e encargos', [
          moneyRow('Base remuneratória', r.salarioBruto),
          moneyRow('Horas extras', r.horasExtrasTotal),
          moneyRow('Adicional noturno', r.adicionalNoturno),
          moneyRow('Insalubridade', r.insalubridade),
          moneyRow('Adicional por tempo de serviço', r.adicionalTempoServico),
          moneyRow('Salário-família', r.salarioFamilia),
          moneyRow('INSS', r.inss),
          moneyRow('IRRF', r.irrf),
          moneyRow('FGTS', r.fgts),
          moneyRow('Benefícios da empresa', r.beneficiosEmpresa),
          moneyRow('Encargos previdenciários / SAT / FAP', r.encargosPrevidenciarios),
        ]),
        section('Resumo', [
          moneyRow('Salário líquido', r.salarioLiquido),
          moneyRow('Descontos do funcionário', r.descontosFuncionario),
          moneyRow('Custo total do empregador', r.custoEmpregador),
        ]),
      ];
    case 'rescisao': {
      return [
        section('Parâmetros informados', [
          row('Motivo da rescisão', String(p.tipo).replaceAll('_', ' ')),
          row('Aviso prévio', String(p.avisoPrevioModo).replaceAll('_', ' ')),
          row('Admissão', dateBr(p.dataAdmissao)),
          row('Desligamento', dateBr(p.dataDemissao)),
          row('Salário informado', moneyInput(p.salario)),
          moneyRow('Base de cálculo', r.salarioBaseCalculo),
          row('Saldo FGTS informado', moneyInput(p.saldoFGTS)),
          row('Férias vencidas', `${p.feriasVencidasPeriodos || 0} período(s)${p.feriasVencidasEmDobro ? ' em dobro' : ''}`),
        ]),
        section('Demonstrativo das verbas', [
          moneyRow('Adicional por tempo de serviço', r.adicionalTempoServico),
          moneyRow('Saldo de salário', r.saldoSalario),
          moneyRow('13º salário proporcional', r.decimoTerceiroProporcional),
          moneyRow('Férias proporcionais', r.feriasProporcionais),
          moneyRow('1/3 sobre férias proporcionais', r.adicionalFerias),
          moneyRow('Férias vencidas', r.feriasVencidas),
          moneyRow('1/3 sobre férias vencidas', r.adicionalFeriasVencidas),
          moneyRow('Aviso prévio indenizado', r.avisoPrevio),
          moneyRow('Multa FGTS', r.multaFGTS),
          moneyRow('INSS estimado', r.inssRescisao),
          moneyRow('IRRF estimado', r.irrfRescisao),
          moneyRow('Aviso prévio descontado', r.avisoPrevioDesconto),
        ]),
        section('Resumo', [
          moneyRow('Total bruto', r.totalBruto),
          moneyRow('Total de descontos', r.totalDescontos),
          moneyRow('Total líquido estimado', r.totalLiquido),
        ]),
      ];
    }
    case 'prolabore':
      return [
        section('Base e retenções', [
          row('Valor informado', moneyInput(data.valor)),
          moneyRow('Pró-labore bruto', r.valorProLabore),
          moneyRow('INSS retido', r.inss),
          moneyRow('IRRF retido', r.irrf),
          moneyRow('CPP estimada', r.cpp),
          moneyRow('Líquido do sócio', r.liquido),
          moneyRow('Custo estimado da empresa', r.custoEmpresa),
        ]),
      ];
    case 'ferias':
      return [
        section('Parâmetros de férias', [
          row('Salário base', moneyInput(p.salarioBruto)),
          row('Dias de férias', `${p.diasFerias} dias`),
          row('Dependentes', p.dependentes),
          row('Abono pecuniário', yesNo(p.abonoPecuniario)),
          row('Adiantamento do 13º', yesNo(p.adiantamento13)),
        ]),
        section('Demonstrativo', [
          moneyRow('Valor das férias', r.valorFerias),
          moneyRow('1/3 constitucional', r.tercoConstitucional),
          moneyRow('Abono pecuniário', r.abonoPecuniario),
          moneyRow('1/3 sobre abono', r.tercoAbono),
          moneyRow('Adiantamento do 13º', r.adiantamento13),
          moneyRow('INSS sobre férias', r.inss),
          moneyRow('IRRF sobre férias', r.irrf),
          moneyRow('Total bruto', r.totalBruto),
          moneyRow('Total líquido', r.totalLiquido),
          moneyRow('Custo da empresa', r.custoEmpresa),
        ]),
      ];
    case 'tempo-empresa':
      return [
        section('Período do vínculo', [
          row('Admissão', dateBr(p.dataAdmissao)),
          row('Data de referência', dateBr(p.dataReferencia)),
          row('Salário base', moneyInput(p.salarioBase)),
          row('Tempo apurado', `${r.anos} anos, ${r.meses} meses e ${r.dias} dias`),
        ]),
        section('Provisões estimadas', [
          moneyRow('Provisão de 13º', r.provisao13),
          moneyRow('Provisão de férias', r.provisaoFerias),
          moneyRow('1/3 de férias provisionado', r.provisaoTerco),
          moneyRow('FGTS acumulado', r.fgtsAcumulado),
          moneyRow('Multa FGTS projetada', r.multaFgtsProjetada),
          moneyRow('Custo total acumulado', r.custoTotalAcumulado),
        ]),
      ];
    case 'encargos-trabalhistas':
      return [section('Encargos patronais', [
        row('Regime', p.regimeEmpresa), row('RAT', `${p.rat}%`), row('FAP', p.fap), row('Terceiros', `${p.terceiros}%`),
        moneyRow('Salário base', parseCurrencyInputValue(p.salarioBruto)), moneyRow('INSS patronal', r.inssPatronal),
        moneyRow('RAT ajustado', r.ratAjustado), moneyRow('Terceiros', r.terceirosValor), moneyRow('FGTS', r.fgts),
        moneyRow('Provisão férias / 13º', r.provisaoFerias13), moneyRow('Total de encargos', r.totalEncargosValor),
      ])];
    case 'simulacao-contratacao':
      return [
        section('Parâmetros comparados', [
          row('Salário / bolsa / contrato', moneyInput(p.salarioProposto)), row('Vale-transporte', moneyInput(p.valeTransporte)),
          row('Vale-alimentação', moneyInput(p.valeAlimentacao)), row('Plano de saúde', moneyInput(p.planoSaude)),
        ]),
        section('Comparativo mensal', [moneyRow('Custo CLT', r.custoCltMensal), moneyRow('Líquido CLT', r.liquidoClt), moneyRow('Custo PJ', r.custoPjMensal), moneyRow('Líquido PJ', r.liquidoPj), moneyRow('Custo estágio', r.custoEstagioMensal), moneyRow('Líquido estágio', r.liquidoEstagio)]),
        section('Comparativo anual', [moneyRow('Custo CLT anual', r.custoCltAnual), moneyRow('Custo PJ anual', r.custoPjAnual), moneyRow('Custo estágio anual', r.custoEstagioAnual)]),
      ];
    case 'das':
      return [section('Apuração do Simples Nacional', [
        row('Anexo', `Anexo ${p.anexo}`), row('Faixa', `${r.faixaNumero}ª faixa`), row('Faturamento mensal', moneyInput(p.faturamentoMensal)),
        moneyRow('RBT12', r.faturamento12Meses), row('Alíquota nominal', formatPercent(r.aliquotaNominal)),
        row('Alíquota efetiva', formatPercent(r.aliquotaEfetiva)), moneyRow('Parcela a deduzir', r.valorDeduzir), moneyRow('DAS estimado', r.valorDAS),
      ])];
    case 'piscofins':
      return [section('Apuração PIS / COFINS', [
        row('Regime', p.regime), row('Faturamento', moneyInput(p.faturamento)), row('Créditos de entrada', moneyInput(p.creditosEntrada)),
        moneyRow('Débito PIS', r.debitoPIS), moneyRow('Débito COFINS', r.debitoCOFINS), moneyRow('Créditos apurados', r.creditosApurados),
        moneyRow('Saldo PIS', r.saldoPIS), moneyRow('Saldo COFINS', r.saldoCOFINS), moneyRow('Total a recolher', r.totalPagar),
      ])];
    case 'multas':
      return [section('Cálculo dos acréscimos', [
        row('Vencimento', dateBr(p.dataVencimento)), row('Pagamento', dateBr(p.dataPagamento)), moneyRow('Valor original', r.valorOriginal),
        row('Dias de atraso', r.diasAtraso), row('Multa aplicada', formatPercent(r.multaPercentual)), moneyRow('Valor da multa', r.multaValor),
        row('Juros Selic', formatPercent(r.jurosPercentual)), moneyRow('Valor dos juros', r.jurosValor), moneyRow('Total a pagar', r.totalPagar),
      ])];
    case 'comparativo-regime':
      return [section('Cenário tributário', [
        row('Faturamento anual', moneyInput(p.faturamentoAnual)), row('Compras / insumos', moneyInput(p.comprasInsumosAnual)),
        row('Folha anual', moneyInput(p.folhaAnual)), row('Margem de lucro', `${p.margemLucro}%`), moneyRow('Simples Nacional', r.simplesNacional),
        moneyRow('Lucro Presumido', r.lucroPresumido), moneyRow('Lucro Real', r.lucroReal), row('Melhor opção estimada', r.melhorOpcao), row('Análise', r.melhorOpcaoDesc),
        ...(r.alertas || []).map((alerta: string, index: number) => row(`Alerta ${index + 1}`, alerta)),
      ])];
    case 'simulacao-imposto':
      return [section('Detalhamento por tributo', [
        row('Atividade', p.tipoAtividade), row('Faturamento mensal', moneyInput(p.faturamentoMensal)), row('Alíquota estimada', `${p.aliquotaEstimada}%`),
        ...r.detalheImpostos.map((item: any) => moneyRow(`${item.nome} (${item.percentual.toFixed(2)}%)`, item.valor)),
        moneyRow('Imposto total', r.impostoTotal), row('Alíquota efetiva', formatPercent(r.aliquotaEfetiva)),
      ])];
    case 'simulacao-custos':
      return [section('Análise de custos', [
        row('Custos fixos', moneyInput(p.custosFixos)), row('Custos variáveis', `${p.custosVariaveisPercentual}%`), row('Markup desejado', `${p.markupDesejado}%`),
        row('Margem de contribuição', `${r.margemContribuicaoPercentual.toFixed(2)}%`), moneyRow('Ponto de equilíbrio', r.pontoEquilibrio),
        moneyRow('Faturamento alvo', r.faturamentoAlvo), moneyRow('Lucro estimado', r.lucroEstimado),
      ])];
    default:
      return [];
  }
};
