import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { calcularSimulacaoRescisao, EMPTY_RESULTADO_RESCISAO } from '../services/simulacoesRpcService';
import { formatCurrencyInputValue, parseCurrencyInputValue } from '../../shared/currencyInputUtils';
import { toLocalDateInputValue } from '../utils/localDate';
import {
  DEFAULT_PARAMETROS_CALCULO,
  PARAMETROS_CALCULO_EVENT,
  parametrosCalculoService,
  type ParametrosCalculo,
} from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

export type AbaCalculo = 'rescisao';
export type AvisoPrevioModo = 'cumprido' | 'descontado' | 'indenizado';
export type AdicionalTempoServicoTipo = 'trienio' | 'quinquenio' | 'manual';

function parseNumberInput(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useSimulacoesCalculos() {
  const status = 'Disponível';
  const [parametrosCalculo, setParametrosCalculo] = useState<ParametrosCalculo>(DEFAULT_PARAMETROS_CALCULO);
  const tiposRescisaoSuportados = useMemo(
    () => new Set(DEFAULT_PARAMETROS_CALCULO.tiposRescisao.map((tipo) => tipo.id)),
    [],
  );

  useEffect(() => {
    const loadParametros = () => {
      parametrosCalculoService.getParametros().then(setParametrosCalculo);
    };

    loadParametros();
    window.addEventListener(PARAMETROS_CALCULO_EVENT, loadParametros);
    return () => {
      window.removeEventListener(PARAMETROS_CALCULO_EVENT, loadParametros);
    };
  }, []);

  const [rescisaoParams, setRescisaoParams] = useState({
    tipo: 'sem_justa_causa',
    avisoPrevioModo: 'indenizado' as AvisoPrevioModo,
    salario: formatCurrencyInputValue(3500),
    dataAdmissao: '2022-01-01',
    dataDemissao: toLocalDateInputValue(),
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

  const solicitacaoRescisao = useMemo(() => ({
    ...rescisaoParams,
    salario: parseCurrencyInputValue(rescisaoParams.salario),
    competencia: rescisaoParams.dataDemissao.slice(0, 7),
    saldoFGTS: parseCurrencyInputValue(rescisaoParams.saldoFGTS),
    feriasVencidasPeriodos: parseNumberInput(rescisaoParams.feriasVencidasPeriodos),
    adicionalTempoServicoPercentual: parseNumberInput(rescisaoParams.adicionalTempoServicoPercentual),
    adicionalTempoServicoValor: parseCurrencyInputValue(rescisaoParams.adicionalTempoServicoValor),
    tipoParametro: tipoRescisaoSelecionado,
    regrasGerais: parametrosCalculo.regrasGerais,
  }), [rescisaoParams, tipoRescisaoSelecionado, parametrosCalculo.regrasGerais]);

  const rescisaoQuery = useQuery({
    queryKey: ['simulacao-rescisao', solicitacaoRescisao],
    queryFn: () => calcularSimulacaoRescisao(solicitacaoRescisao),
    placeholderData: (previousData) => previousData,
  });

  const resultadoRescisao = rescisaoQuery.data?.resultado || EMPTY_RESULTADO_RESCISAO;

  return {
    status: rescisaoQuery.isFetching ? 'Calculando no servidor' : status,
    erroCalculo: rescisaoQuery.error instanceof Error ? rescisaoQuery.error.message : '',
    calculando: rescisaoQuery.isFetching,
    resultadoCarregado: Boolean(rescisaoQuery.data),
    relatorioDisponivel: rescisaoQuery.isSuccess && !rescisaoQuery.isFetching,
    abaAtiva: 'rescisao' as const,
    rescisaoParams,
    setRescisaoParams,
    resultadoRescisao,
    tiposRescisao: parametrosCalculo.tiposRescisao.filter(
      (tipo) => tipo.ativo && tiposRescisaoSuportados.has(tipo.id),
    ),
  };
}
