import { useEffect, useMemo, useState } from 'react';
import {
  rpc_calcularFolha,
  rpc_calcularRescisao,
  rpc_calcularProLabore,
  rpc_calcularDAS,
  rpc_calcularPisCofins,
  rpc_calcularMultaJuros,
} from '../services/calculos.service';
import {
  rpc_calcularFerias,
  rpc_calcularTempoEmpresa,
  rpc_calcularEncargosTrabalhistas,
  rpc_calcularContratacao,
  rpc_calcularComparativoRegime,
  rpc_calcularSimulacaoImposto,
  rpc_calcularCustos,
} from '../services/calculosNovas.service';
import { formatCurrencyInputValue, parseCurrencyInputValue } from '../../shared/currencyInputUtils';
import { persistedStorage } from '../../../../lib/persistedStorage';
import {
  DEFAULT_PARAMETROS_CALCULO,
  PARAMETROS_CALCULO_EVENT,
  parametrosCalculoService,
  type ParametrosCalculo,
} from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

export type AbaCalculo =
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

export type AvisoPrevioModo = 'cumprido' | 'descontado' | 'indenizado';
export type AdicionalTempoServicoTipo = 'trienio' | 'quinquenio' | 'manual';

export function useSimulacoesCalculos() {
  const status = 'Em desenvolvimento';
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
  const resultadoFolha = useMemo(() => rpc_calcularFolha({
    tipoFuncionario: folhaParams.tipoFuncionario,
    competencia: folhaParams.competencia,
    regiao: folhaParams.regiao,
    salarioBruto: parseCurrencyInputValue(folhaParams.salarioBruto),
    dependentes: parseNumberInput(folhaParams.dependentes),
    adicionalPericulosidade: parseCurrencyInputValue(folhaParams.adicionalPericulosidade),
    adicionalNoturnoPercentual: parseNumberInput(folhaParams.adicionalNoturnoPercentual),
    insalubridadePercentual: parseNumberInput(folhaParams.insalubridadePercentual),
    adicionalTempoServicoAtivo: folhaParams.adicionalTempoServicoAtivo,
    adicionalTempoServicoTipo: folhaParams.adicionalTempoServicoTipo,
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
    valeTransporteAtivo: folhaParams.valeTransporteAtivo,
    valorValeTransporte: parseCurrencyInputValue(folhaParams.valorValeTransporte),
    valeAlimentacaoEmpresa: parseCurrencyInputValue(folhaParams.valeAlimentacaoEmpresa),
    valeAlimentacaoDesconto: parseCurrencyInputValue(folhaParams.valeAlimentacaoDesconto),
    planoSaudeEmpresa: parseCurrencyInputValue(folhaParams.planoSaudeEmpresa),
    planoSaudeDesconto: parseCurrencyInputValue(folhaParams.planoSaudeDesconto),
    odontologicoEmpresa: parseCurrencyInputValue(folhaParams.odontologicoEmpresa),
    odontologicoDesconto: parseCurrencyInputValue(folhaParams.odontologicoDesconto),
    pensaoAlimenticia: parseCurrencyInputValue(folhaParams.pensaoAlimenticia),
    faltasDias: parseNumberInput(folhaParams.faltasDias),
    atestadosDias: parseNumberInput(folhaParams.atestadosDias),
    descontoManualValor: parseCurrencyInputValue(folhaParams.descontoManualValor),
    adicionalManualValor: parseCurrencyInputValue(folhaParams.adicionalManualValor),
    salarioComparacao: parseCurrencyInputValue(folhaParams.salarioComparacao),
    aumentoPercentual: parseNumberInput(folhaParams.aumentoPercentual),
  }), [folhaParams]);

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
  const resultadoRescisao = useMemo(() => rpc_calcularRescisao(
    rescisaoParams.tipo,
    parseCurrencyInputValue(rescisaoParams.salario),
    rescisaoParams.dataAdmissao,
    rescisaoParams.dataDemissao,
    parseCurrencyInputValue(rescisaoParams.saldoFGTS),
    tipoRescisaoSelecionado,
    rescisaoParams.avisoPrevioModo,
    parseNumberInput(rescisaoParams.feriasVencidasPeriodos),
    rescisaoParams.feriasVencidasEmDobro,
    {
      ativo: rescisaoParams.adicionalTempoServicoAtivo,
      tipo: rescisaoParams.adicionalTempoServicoTipo,
      percentual: parseNumberInput(rescisaoParams.adicionalTempoServicoPercentual),
      valorManual: parseCurrencyInputValue(rescisaoParams.adicionalTempoServicoValor),
    },
  ), [rescisaoParams, tipoRescisaoSelecionado]);

  // ── Pró-Labore ────────────────────────────────────────
  const [prolaboreValor, setProlaboreValor] = useState(formatCurrencyInputValue(5000));
  const resultadoProLabore = useMemo(
    () => rpc_calcularProLabore(parseCurrencyInputValue(prolaboreValor)),
    [prolaboreValor],
  );

  // ── DAS ───────────────────────────────────────────────
  const [dasParams, setDasParams] = useState({
    faturamentoMensal: formatCurrencyInputValue(85000),
    faturamento12Meses: formatCurrencyInputValue(980000),
    anexo: 'III',
  });
  const resultadoDAS = useMemo(() => rpc_calcularDAS(
    parseCurrencyInputValue(dasParams.faturamentoMensal),
    parseCurrencyInputValue(dasParams.faturamento12Meses),
    dasParams.anexo,
    parametrosCalculo.anexosDas,
  ), [dasParams, parametrosCalculo.anexosDas]);

  // ── PIS/COFINS ────────────────────────────────────────
  const [pisParams, setPisParams] = useState({
    faturamento: formatCurrencyInputValue(320000),
    regime: 'cumulativo',
    creditosEntrada: formatCurrencyInputValue(0),
  });
  const regimePisSelecionado = useMemo(() => {
    return parametrosCalculo.regimesPisCofins.find((regime) => regime.id === pisParams.regime);
  }, [parametrosCalculo.regimesPisCofins, pisParams.regime]);
  const resultadoPisCofins = useMemo(() => rpc_calcularPisCofins(
    parseCurrencyInputValue(pisParams.faturamento),
    pisParams.regime,
    parseCurrencyInputValue(pisParams.creditosEntrada),
    regimePisSelecionado,
  ), [pisParams, regimePisSelecionado]);

  // ── Multas ────────────────────────────────────────────
  const [multasParams, setMultasParams] = useState({
    valorOriginal: formatCurrencyInputValue(5000),
    dataVencimento: '2026-05-20',
    dataPagamento: new Date().toISOString().split('T')[0],
  });
  const resultadoMultas = useMemo(() => rpc_calcularMultaJuros(
    parseCurrencyInputValue(multasParams.valorOriginal),
    multasParams.dataVencimento,
    multasParams.dataPagamento,
  ), [multasParams]);

  // ── Férias [NEW] ──────────────────────────────────────
  const [feriasParams, setFeriasParams] = useState({
    salarioBruto: formatCurrencyInputValue(3500),
    diasFerias: '30',
    abonoPecuniario: false,
    adiantamento13: false,
    dependentes: '0',
  });
  const resultadoFerias = useMemo(() => rpc_calcularFerias({
    salarioBruto: parseCurrencyInputValue(feriasParams.salarioBruto),
    diasFerias: parseNumberInput(feriasParams.diasFerias),
    abonoPecuniario: feriasParams.abonoPecuniario,
    adiantamento13: feriasParams.adiantamento13,
    dependentes: parseNumberInput(feriasParams.dependentes),
    regrasGerais: parametrosCalculo.regrasGerais,
  }), [feriasParams, parametrosCalculo.regrasGerais]);

  // ── Tempo Empresa [NEW] ──────────────────────────────
  const [tempoEmpresaParams, setTempoEmpresaParams] = useState({
    dataAdmissao: '2022-01-01',
    dataReferencia: new Date().toISOString().split('T')[0],
    salarioBase: formatCurrencyInputValue(3500),
  });
  const resultadoTempoEmpresa = useMemo(() => rpc_calcularTempoEmpresa({
    dataAdmissao: tempoEmpresaParams.dataAdmissao,
    dataReferencia: tempoEmpresaParams.dataReferencia,
    salarioBase: parseCurrencyInputValue(tempoEmpresaParams.salarioBase),
    regrasGerais: parametrosCalculo.regrasGerais,
  }), [tempoEmpresaParams, parametrosCalculo.regrasGerais]);

  // ── Encargos Trabalhistas [NEW] ──────────────────────
  const [encargosParams, setEncargosParams] = useState({
    salarioBruto: formatCurrencyInputValue(10000),
    regimeEmpresa: 'simples_geral',
    rat: '1',
    fap: '1.0',
    terceiros: '5.8',
  });
  const resultadoEncargos = useMemo(() => rpc_calcularEncargosTrabalhistas({
    salarioBruto: parseCurrencyInputValue(encargosParams.salarioBruto),
    regimeEmpresa: encargosParams.regimeEmpresa,
    rat: parseNumberInput(encargosParams.rat),
    fap: parseNumberInput(encargosParams.fap),
    terceiros: parseNumberInput(encargosParams.terceiros),
    regrasGerais: parametrosCalculo.regrasGerais,
  }), [encargosParams, parametrosCalculo.regrasGerais]);

  // ── Simulação Contratação [NEW] ──────────────────────
  const [contratacaoParams, setContratacaoParams] = useState({
    salarioProposto: formatCurrencyInputValue(3500),
    valeTransporte: formatCurrencyInputValue(200),
    valeAlimentacao: formatCurrencyInputValue(500),
    planoSaude: formatCurrencyInputValue(300),
  });
  const resultadoContratacao = useMemo(() => rpc_calcularContratacao({
    salarioProposto: parseCurrencyInputValue(contratacaoParams.salarioProposto),
    valeTransporte: parseCurrencyInputValue(contratacaoParams.valeTransporte),
    valeAlimentacao: parseCurrencyInputValue(contratacaoParams.valeAlimentacao),
    planoSaude: parseCurrencyInputValue(contratacaoParams.planoSaude),
    regrasGerais: parametrosCalculo.regrasGerais,
  }), [contratacaoParams, parametrosCalculo.regrasGerais]);

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

  const resultadoComparativoRegime = useMemo(() => rpc_calcularComparativoRegime({
    faturamentoAnual: parseCurrencyInputValue(comparativoRegimeParams.faturamentoAnual),
    comprasInsumosAnual: parseCurrencyInputValue(comparativoRegimeParams.comprasInsumosAnual),
    folhaAnual: parseCurrencyInputValue(comparativoRegimeParams.folhaAnual),
    margemLucro: parseNumberInput(comparativoRegimeParams.margemLucro),
    tipoEmpresa: activeTipoEmpresa,
    naturezaJuridica: activeNaturezaJuridica,
  }), [comparativoRegimeParams, activeTipoEmpresa, activeNaturezaJuridica]);

  // ── Simulação Imposto [NEW] ──────────────────────────
  const [simulacaoImpostoParams, setSimulacaoImpostoParams] = useState({
    faturamentoMensal: formatCurrencyInputValue(50000),
    tipoAtividade: 'servico',
    aliquotaEstimada: '6.0',
  });
  const resultadoSimulacaoImposto = useMemo(() => rpc_calcularSimulacaoImposto({
    faturamentoMensal: parseCurrencyInputValue(simulacaoImpostoParams.faturamentoMensal),
    tipoAtividade: simulacaoImpostoParams.tipoAtividade,
    aliquotaEstimada: parseNumberInput(simulacaoImpostoParams.aliquotaEstimada),
  }), [simulacaoImpostoParams]);

  // ── Simulação Custos [NEW] ───────────────────────────
  const [simulacaoCustosParams, setSimulacaoCustosParams] = useState({
    custosFixos: formatCurrencyInputValue(15000),
    custosVariaveisPercentual: '15',
    markupDesejado: '20',
  });
  const resultadoCustos = useMemo(() => rpc_calcularCustos({
    custosFixos: parseCurrencyInputValue(simulacaoCustosParams.custosFixos),
    custosVariaveisPercentual: parseNumberInput(simulacaoCustosParams.custosVariaveisPercentual),
    markupDesejado: parseNumberInput(simulacaoCustosParams.markupDesejado),
  }), [simulacaoCustosParams]);

  return {
    status,
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

function parseNumberInput(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}
