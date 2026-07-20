import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { calcularSimulacaoContabil, EMPTY_RESULTADOS, type ResultadosSimulacoes } from '../services/simulacoesRpcService';
import { formatCurrencyInputValue, parseCurrencyInputValue } from '../../shared/currencyInputUtils';
import { persistedStorage } from '../../../../lib/persistedStorage';
import {
  DEFAULT_PARAMETROS_CALCULO,
  PARAMETROS_CALCULO_EVENT,
  parametrosCalculoService,
  type ParametrosCalculo,
} from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

export type AbaCalculoExistente =
  | 'folha'
  | 'rescisao'
  | 'prolabore'
  | 'das'
  | 'piscofins'
  | 'multas'
  | 'ferias'
  | 'tempo-empresa'
  | 'encargos-trabalhistas'
  | 'simulacao-contratacao'
  | 'comparativo-regime'
  | 'simulacao-imposto'
  | 'simulacao-custos';

export type AbaCalculo = AbaCalculoExistente
  | 'carne-leao'
  | 'irpf'
  | 'lucros-dividendos'
  | 'ganho-capital'
  | 'mei';

export type AvisoPrevioModo = 'cumprido' | 'descontado' | 'indenizado';
export type AdicionalTempoServicoTipo = 'trienio' | 'quinquenio' | 'manual';

export function useSimulacoesCalculos() {
  const status = 'Disponível';
  const [abaAtiva, setAbaAtiva] = useState<AbaCalculo>('folha');
  const [parametrosCalculo, setParametrosCalculo] = useState<ParametrosCalculo>(DEFAULT_PARAMETROS_CALCULO);
  const [tiposEmpresa, setTiposEmpresa] = useState<{ id: string; nome: string; descricao: string; status: string }[]>([]);
  const [naturezasJuridicas, setNaturezasJuridicas] = useState<{ id: string; nome: string; descricao: string; status: string }[]>([]);

  useEffect(() => {
    const loadParametros = () => {
      parametrosCalculoService.getParametros().then(setParametrosCalculo);
    };

    const loadParametrizacoes = () => {
      try {
        const savedTipos = persistedStorage.getItem('arkhen_param_tipos-empresa');
        if (savedTipos) {
          setTiposEmpresa(JSON.parse(savedTipos));
        } else {
          setTiposEmpresa([
            { id: 'te-1', nome: 'Pessoa Física', descricao: 'Cliente PF/autônomo sem CNPJ, usado para atendimentos e rotinas pessoais.', status: 'Padrão' },
            { id: 'te-2', nome: 'MEI', descricao: 'Microempreendedor individual com rotinas simplificadas.', status: 'Padrão' },
            { id: 'te-3', nome: 'Microempresa', descricao: 'Empresa cliente com faturamento e obrigações de pequeno porte.', status: 'Ativo' },
            { id: 'te-4', nome: 'Empresa de Pequeno Porte', descricao: 'Cliente com maior volume fiscal, contábil e trabalhista.', status: 'Ativo' },
            { id: 'te-5', nome: 'Isenta / Imune', descricao: 'Entidade ou operação com tratamento tributário diferenciado.', status: 'Ativo' },
            { id: 'te-6', nome: 'Holding / Patrimonial', descricao: 'Empresa com acompanhamento societário e documental específico.', status: 'Ativo' },
          ]);
        }
      } catch (e) {
        console.error(e);
      }

      try {
        const savedNaturezas = persistedStorage.getItem('arkhen_param_natureza-juridica');
        if (savedNaturezas) {
          setNaturezasJuridicas(JSON.parse(savedNaturezas));
        } else {
          setNaturezasJuridicas([
            { id: 'nj-1', nome: 'Empresário Individual', descricao: 'Pessoa física titular de atividade empresarial.', status: 'Ativo' },
            { id: 'nj-2', nome: 'Sociedade Limitada', descricao: 'Empresa formada por sócios com quotas de participação.', status: 'Padrão' },
            { id: 'nj-3', nome: 'Sociedade Limitada Unipessoal', descricao: 'Modelo societário com um único titular.', status: 'Ativo' },
            { id: 'nj-4', nome: 'Associação Privada', descricao: 'Entidade sem fins lucrativos com obrigações próprias.', status: 'Ativo' },
          ]);
        }
      } catch (e) {
        console.error(e);
      }
    };

    loadParametros();
    loadParametrizacoes();
    window.addEventListener(PARAMETROS_CALCULO_EVENT, loadParametros);
    return () => {
      window.removeEventListener(PARAMETROS_CALCULO_EVENT, loadParametros);
    };
  }, []);

  const tiposEmpresaAtivos = useMemo(() => {
    return tiposEmpresa.filter(t => t.status === 'Ativo' || t.status === 'Padrão');
  }, [tiposEmpresa]);

  const naturezasJuridicasAtivas = useMemo(() => {
    return naturezasJuridicas.filter(n => n.status === 'Ativo' || n.status === 'Padrão');
  }, [naturezasJuridicas]);

  // ── Folha ─────────────────────────────────────────────
  const [folhaParams, setFolhaParams] = useState({
    tipoFuncionario: 'clt',
    competencia: '2026-06',
    regiao: 'nordeste',
    salarioBruto: formatCurrencyInputValue(3500),
    dependentes: '0',
    adicionalPericulosidade: formatCurrencyInputValue(0),
    adicionalNoturnoPercentual: '0',
    insalubridadePercentual: '0',
    adicionalTempoServicoAtivo: false,
    adicionalTempoServicoTipo: 'trienio' as AdicionalTempoServicoTipo,
    adicionalTempoServicoAnos: '0',
    adicionalTempoServicoPercentual: '3',
    adicionalTempoServicoValor: formatCurrencyInputValue(0),
    horasExtras50: '0',
    valorHora50: formatCurrencyInputValue(0),
    horasExtras100: '0',
    valorHora100: formatCurrencyInputValue(0),
    horasExtras150: '0',
    valorHora150: formatCurrencyInputValue(0),
    horasExtrasDomingo: '0',
    valorHoraDomingo: formatCurrencyInputValue(0),
    horasExtrasFeriado: '0',
    valorHoraFeriado: formatCurrencyInputValue(0),
    valeTransporteAtivo: false,
    valorValeTransporte: formatCurrencyInputValue(0),
    valeAlimentacaoEmpresa: formatCurrencyInputValue(0),
    valeAlimentacaoDesconto: formatCurrencyInputValue(0),
    planoSaudeEmpresa: formatCurrencyInputValue(0),
    planoSaudeDesconto: formatCurrencyInputValue(0),
    odontologicoEmpresa: formatCurrencyInputValue(0),
    odontologicoDesconto: formatCurrencyInputValue(0),
    pensaoAlimenticia: formatCurrencyInputValue(0),
    faltasDias: '0',
    atestadosDias: '0',
    descontoManualDescricao: '',
    descontoManualValor: formatCurrencyInputValue(0),
    adicionalManualDescricao: '',
    adicionalManualValor: formatCurrencyInputValue(0),
    salarioComparacao: formatCurrencyInputValue(4200),
    aumentoPercentual: '8',
  });

  // ── Rescisão ──────────────────────────────────────────
  const [rescisaoParams, setRescisaoParams] = useState({
    tipo: 'sem_justa_causa',
    avisoPrevioModo: 'indenizado' as AvisoPrevioModo,
    salario: formatCurrencyInputValue(3500),
    dataAdmissao: '2022-01-01',
    dataDemissao: new Date().toISOString().split('T')[0],
    saldoFGTS: formatCurrencyInputValue(8500),
    feriasVencidasPeriodos: '0',
    feriasVencidasEmDobro: false,
    adicionalTempoServicoAtivo: false,
    adicionalTempoServicoTipo: 'trienio' as AdicionalTempoServicoTipo,
    adicionalTempoServicoPercentual: '3',
    adicionalTempoServicoValor: formatCurrencyInputValue(0),
  });
  const tipoRescisaoSelecionado = useMemo(() => {
    return parametrosCalculo.tiposRescisao.find((tipo) => tipo.id === rescisaoParams.tipo);
  }, [parametrosCalculo.tiposRescisao, rescisaoParams.tipo]);

  // ── Pró-Labore ────────────────────────────────────────
  const [prolaboreValor, setProlaboreValor] = useState(formatCurrencyInputValue(5000));

  // ── DAS ───────────────────────────────────────────────
  const [dasParams, setDasParams] = useState({
    faturamentoMensal: formatCurrencyInputValue(85000),
    faturamento12Meses: formatCurrencyInputValue(980000),
    anexo: 'III',
  });

  // ── PIS/COFINS ────────────────────────────────────────
  const [pisParams, setPisParams] = useState({
    faturamento: formatCurrencyInputValue(320000),
    regime: 'cumulativo',
    creditosEntrada: formatCurrencyInputValue(0),
  });
  const regimePisSelecionado = useMemo(() => {
    return parametrosCalculo.regimesPisCofins.find((regime) => regime.id === pisParams.regime);
  }, [parametrosCalculo.regimesPisCofins, pisParams.regime]);

  // ── Multas ────────────────────────────────────────────
  const [multasParams, setMultasParams] = useState({
    valorOriginal: formatCurrencyInputValue(5000),
    dataVencimento: '2026-05-20',
    dataPagamento: new Date().toISOString().split('T')[0],
  });

  // ── Férias [NEW] ──────────────────────────────────────
  const [feriasParams, setFeriasParams] = useState({
    salarioBruto: formatCurrencyInputValue(3500),
    diasFerias: '30',
    abonoPecuniario: false,
    adiantamento13: false,
    dependentes: '0',
  });

  // ── Tempo Empresa [NEW] ──────────────────────────────
  const [tempoEmpresaParams, setTempoEmpresaParams] = useState({
    dataAdmissao: '2022-01-01',
    dataReferencia: new Date().toISOString().split('T')[0],
    salarioBase: formatCurrencyInputValue(3500),
  });

  // ── Encargos Trabalhistas [NEW] ──────────────────────
  const [encargosParams, setEncargosParams] = useState({
    salarioBruto: formatCurrencyInputValue(10000),
    regimeEmpresa: 'simples_geral',
    rat: '1',
    fap: '1.0',
    terceiros: '5.8',
  });

  // ── Simulação Contratação [NEW] ──────────────────────
  const [contratacaoParams, setContratacaoParams] = useState({
    salarioProposto: formatCurrencyInputValue(3500),
    valeTransporte: formatCurrencyInputValue(200),
    valeAlimentacao: formatCurrencyInputValue(500),
    planoSaude: formatCurrencyInputValue(300),
  });

  // ── Comparativo Regime [NEW] ─────────────────────────
  const [comparativoRegimeParams, setComparativoRegimeParams] = useState({
    faturamentoAnual: formatCurrencyInputValue(1200000),
    comprasInsumosAnual: formatCurrencyInputValue(300000),
    folhaAnual: formatCurrencyInputValue(250000),
    margemLucro: '20',
    tipoEmpresa: '',
    naturezaJuridica: '',
  });

  const activeTipoEmpresa = useMemo(() => {
    return comparativoRegimeParams.tipoEmpresa || (tiposEmpresaAtivos[0]?.nome || 'Microempresa');
  }, [comparativoRegimeParams.tipoEmpresa, tiposEmpresaAtivos]);

  const activeNaturezaJuridica = useMemo(() => {
    return comparativoRegimeParams.naturezaJuridica || (naturezasJuridicasAtivas[0]?.nome || 'Sociedade Limitada');
  }, [comparativoRegimeParams.naturezaJuridica, naturezasJuridicasAtivas]);


  // ── Simulação Imposto [NEW] ──────────────────────────
  const [simulacaoImpostoParams, setSimulacaoImpostoParams] = useState({
    faturamentoMensal: formatCurrencyInputValue(50000),
    tipoAtividade: 'servico',
    aliquotaEstimada: '6.0',
  });

  // ── Simulação Custos [NEW] ───────────────────────────
  const [simulacaoCustosParams, setSimulacaoCustosParams] = useState({
    custosFixos: formatCurrencyInputValue(15000),
    custosVariaveisPercentual: '15',
    markupDesejado: '20',
  });

  const solicitacoes = useMemo(() => ({
    folha: {
      ...folhaParams,
      salarioBruto: parseCurrencyInputValue(folhaParams.salarioBruto),
      dependentes: parseNumberInput(folhaParams.dependentes),
      adicionalPericulosidade: parseCurrencyInputValue(folhaParams.adicionalPericulosidade),
      adicionalNoturnoPercentual: parseNumberInput(folhaParams.adicionalNoturnoPercentual),
      insalubridadePercentual: parseNumberInput(folhaParams.insalubridadePercentual),
      adicionalTempoServicoAnos: parseNumberInput(folhaParams.adicionalTempoServicoAnos),
      adicionalTempoServicoPercentual: parseNumberInput(folhaParams.adicionalTempoServicoPercentual),
      adicionalTempoServicoValor: parseCurrencyInputValue(folhaParams.adicionalTempoServicoValor),
      horasExtras: [
        { quantidade: parseNumberInput(folhaParams.horasExtras50), valorHora: parseCurrencyInputValue(folhaParams.valorHora50), multiplicador: 1.5 },
        { quantidade: parseNumberInput(folhaParams.horasExtras100), valorHora: parseCurrencyInputValue(folhaParams.valorHora100), multiplicador: 2 },
        { quantidade: parseNumberInput(folhaParams.horasExtras150), valorHora: parseCurrencyInputValue(folhaParams.valorHora150), multiplicador: 2.5 },
        { quantidade: parseNumberInput(folhaParams.horasExtrasDomingo), valorHora: parseCurrencyInputValue(folhaParams.valorHoraDomingo), multiplicador: 2 },
        { quantidade: parseNumberInput(folhaParams.horasExtrasFeriado), valorHora: parseCurrencyInputValue(folhaParams.valorHoraFeriado), multiplicador: 2 },
      ],
      valorValeTransporte: parseCurrencyInputValue(folhaParams.valorValeTransporte),
      valeAlimentacaoEmpresa: parseCurrencyInputValue(folhaParams.valeAlimentacaoEmpresa),
      valeAlimentacaoDesconto: parseCurrencyInputValue(folhaParams.valeAlimentacaoDesconto),
      planoSaudeEmpresa: parseCurrencyInputValue(folhaParams.planoSaudeEmpresa),
      planoSaudeDesconto: parseCurrencyInputValue(folhaParams.planoSaudeDesconto),
      odontologicoEmpresa: parseCurrencyInputValue(folhaParams.odontologicoEmpresa),
      odontologicoDesconto: parseCurrencyInputValue(folhaParams.odontologicoDesconto),
      pensaoAlimenticia: parseCurrencyInputValue(folhaParams.pensaoAlimenticia),
      faltasDias: parseNumberInput(folhaParams.faltasDias), atestadosDias: parseNumberInput(folhaParams.atestadosDias),
      descontoManualValor: parseCurrencyInputValue(folhaParams.descontoManualValor),
      adicionalManualValor: parseCurrencyInputValue(folhaParams.adicionalManualValor),
    },
    rescisao: {
      ...rescisaoParams, salario: parseCurrencyInputValue(rescisaoParams.salario),
      competencia: rescisaoParams.dataDemissao.slice(0, 7),
      saldoFGTS: parseCurrencyInputValue(rescisaoParams.saldoFGTS),
      feriasVencidasPeriodos: parseNumberInput(rescisaoParams.feriasVencidasPeriodos),
      tipoParametro: tipoRescisaoSelecionado,
      regrasGerais: parametrosCalculo.regrasGerais,
    },
    prolabore: { valor: parseCurrencyInputValue(prolaboreValor), regrasGerais: parametrosCalculo.regrasGerais },
    das: { faturamentoMensal: parseCurrencyInputValue(dasParams.faturamentoMensal), faturamento12Meses: parseCurrencyInputValue(dasParams.faturamento12Meses), anexo: dasParams.anexo },
    piscofins: { faturamento: parseCurrencyInputValue(pisParams.faturamento), regime: pisParams.regime, creditosEntrada: parseCurrencyInputValue(pisParams.creditosEntrada), regimeConfig: regimePisSelecionado },
    multas: { valorOriginal: parseCurrencyInputValue(multasParams.valorOriginal), dataVencimento: multasParams.dataVencimento, dataPagamento: multasParams.dataPagamento },
    ferias: { salarioBruto: parseCurrencyInputValue(feriasParams.salarioBruto), diasFerias: parseNumberInput(feriasParams.diasFerias), abonoPecuniario: feriasParams.abonoPecuniario, adiantamento13: feriasParams.adiantamento13, dependentes: parseNumberInput(feriasParams.dependentes), regrasGerais: parametrosCalculo.regrasGerais },
    'tempo-empresa': { ...tempoEmpresaParams, competencia: tempoEmpresaParams.dataReferencia.slice(0, 7), salarioBase: parseCurrencyInputValue(tempoEmpresaParams.salarioBase), regrasGerais: parametrosCalculo.regrasGerais },
    'encargos-trabalhistas': { ...encargosParams, salarioBruto: parseCurrencyInputValue(encargosParams.salarioBruto), rat: parseNumberInput(encargosParams.rat), fap: parseNumberInput(encargosParams.fap), terceiros: parseNumberInput(encargosParams.terceiros), regrasGerais: parametrosCalculo.regrasGerais },
    'simulacao-contratacao': { salarioProposto: parseCurrencyInputValue(contratacaoParams.salarioProposto), valeTransporte: parseCurrencyInputValue(contratacaoParams.valeTransporte), valeAlimentacao: parseCurrencyInputValue(contratacaoParams.valeAlimentacao), planoSaude: parseCurrencyInputValue(contratacaoParams.planoSaude), regrasGerais: parametrosCalculo.regrasGerais },
    'comparativo-regime': { faturamentoAnual: parseCurrencyInputValue(comparativoRegimeParams.faturamentoAnual), comprasInsumosAnual: parseCurrencyInputValue(comparativoRegimeParams.comprasInsumosAnual), folhaAnual: parseCurrencyInputValue(comparativoRegimeParams.folhaAnual), margemLucro: parseNumberInput(comparativoRegimeParams.margemLucro), tipoEmpresa: activeTipoEmpresa, naturezaJuridica: activeNaturezaJuridica },
    'simulacao-imposto': { faturamentoMensal: parseCurrencyInputValue(simulacaoImpostoParams.faturamentoMensal), tipoAtividade: simulacaoImpostoParams.tipoAtividade, aliquotaEstimada: parseNumberInput(simulacaoImpostoParams.aliquotaEstimada) },
    'simulacao-custos': { custosFixos: parseCurrencyInputValue(simulacaoCustosParams.custosFixos), custosVariaveisPercentual: parseNumberInput(simulacaoCustosParams.custosVariaveisPercentual), markupDesejado: parseNumberInput(simulacaoCustosParams.markupDesejado) },
  }), [folhaParams, rescisaoParams, tipoRescisaoSelecionado, prolaboreValor, dasParams, pisParams,
    regimePisSelecionado, multasParams, feriasParams, tempoEmpresaParams, encargosParams,
    contratacaoParams, comparativoRegimeParams,
    simulacaoImpostoParams, simulacaoCustosParams, parametrosCalculo.regrasGerais,
    activeTipoEmpresa, activeNaturezaJuridica]);

  const abaExistente = isAbaExistente(abaAtiva) ? abaAtiva : null;
  const simulacoesQuery = useQuery({
    queryKey: ['simulacao-contabil', abaExistente, abaExistente ? solicitacoes[abaExistente] : null],
    queryFn: () => calcularSimulacaoContabil(abaExistente!, solicitacoes[abaExistente!]),
    enabled: abaExistente !== null,
  });
  const resultados = {
    ...EMPTY_RESULTADOS,
    ...(simulacoesQuery.data && abaExistente ? { [abaExistente]: simulacoesQuery.data.resultado } : {}),
  } as ResultadosSimulacoes;
  const resultadoFolha = resultados.folha;
  const resultadoRescisao = resultados.rescisao;
  const resultadoProLabore = resultados.prolabore;
  const resultadoDAS = resultados.das;
  const resultadoPisCofins = resultados.piscofins;
  const resultadoMultas = resultados.multas;
  const resultadoFerias = resultados.ferias;
  const resultadoTempoEmpresa = resultados['tempo-empresa'];
  const resultadoEncargos = resultados['encargos-trabalhistas'];
  const resultadoContratacao = resultados['simulacao-contratacao'];
  const resultadoComparativoRegime = resultados['comparativo-regime'];
  const resultadoSimulacaoImposto = resultados['simulacao-imposto'];
  const resultadoCustos = resultados['simulacao-custos'];

  return {
    status: simulacoesQuery.isFetching ? 'Calculando no servidor' : status,
    erroCalculo: simulacoesQuery.error instanceof Error ? simulacoesQuery.error.message : '',
    abaAtiva,
    setAbaAtiva,
    folhaParams, setFolhaParams, resultadoFolha,
    rescisaoParams, setRescisaoParams, resultadoRescisao,
    tiposRescisao: parametrosCalculo.tiposRescisao.filter((tipo) => tipo.ativo),
    prolaboreValor, setProlaboreValor, resultadoProLabore,
    dasParams, setDasParams, resultadoDAS,
    anexosDas: parametrosCalculo.anexosDas.filter((anexo) => anexo.ativo),
    pisParams, setPisParams, resultadoPisCofins,
    regimesPisCofins: parametrosCalculo.regimesPisCofins.filter((regime) => regime.ativo),
    multasParams, setMultasParams, resultadoMultas,
    
    // Novas calculadoras
    feriasParams, setFeriasParams, resultadoFerias,
    tempoEmpresaParams, setTempoEmpresaParams, resultadoTempoEmpresa,
    encargosParams, setEncargosParams, resultadoEncargos,
    contratacaoParams, setContratacaoParams, resultadoContratacao,
    comparativoRegimeParams, setComparativoRegimeParams, resultadoComparativoRegime,
    simulacaoImpostoParams, setSimulacaoImpostoParams, resultadoSimulacaoImposto,
    simulacaoCustosParams, setSimulacaoCustosParams, resultadoCustos,
    tiposEmpresaAtivos,
    naturezasJuridicasAtivas,
    activeTipoEmpresa,
    activeNaturezaJuridica,
  };
}

function isAbaExistente(value: AbaCalculo): value is AbaCalculoExistente {
  return !['carne-leao', 'irpf', 'lucros-dividendos', 'ganho-capital', 'mei'].includes(value);
}

function parseNumberInput(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}
