import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrencyInputValue, parseCurrencyInputValue } from '../../shared/currencyInputUtils';
import {
  PARAMETROS_CALCULO_QUERY_KEY,
  parametrosCalculoService,
} from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';
import { calcularRescisao, EMPTY_RESULTADO_RESCISAO } from './rescisaoService';
import type { RescisaoParams } from './rescisaoTypes';
import { getLocalDateInputValue } from './rescisaoRules';

const createInitialParams = (): RescisaoParams => ({
  tipo: 'sem_justa_causa',
  avisoPrevioModo: 'indenizado',
  salario: formatCurrencyInputValue(3500),
  dataAdmissao: '2022-01-01',
  dataDemissao: getLocalDateInputValue(),
  saldoFGTS: formatCurrencyInputValue(8500),
  feriasVencidasPeriodos: '0',
  feriasVencidasEmDobro: false,
  adicionalTempoServicoAtivo: false,
  adicionalTempoServicoTipo: 'trienio',
  adicionalTempoServicoPercentual: '3',
  adicionalTempoServicoValor: formatCurrencyInputValue(0),
});

const parseNumberInput = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function useRescisaoCalculator() {
  const [params, setParams] = useState<RescisaoParams>(() => createInitialParams());
  const parametrosQuery = useQuery({
    queryKey: PARAMETROS_CALCULO_QUERY_KEY,
    queryFn: () => parametrosCalculoService.getParametros(),
    staleTime: 30_000,
  });
  const tiposRescisao = useMemo(
    () => parametrosQuery.data?.tiposRescisao.filter((tipo) => tipo.ativo) ?? [],
    [parametrosQuery.data],
  );

  useEffect(() => {
    setParams((current) => {
      if (tiposRescisao.some((tipo) => tipo.id === current.tipo) || !tiposRescisao[0]) {
        return current;
      }
      return {
        ...current,
        tipo: tiposRescisao[0].id,
        avisoPrevioModo: 'cumprido',
      };
    });
  }, [tiposRescisao]);

  const request = useMemo(() => ({
    ...params,
    competencia: params.dataDemissao.slice(0, 7),
    salario: parseCurrencyInputValue(params.salario),
    saldoFGTS: parseCurrencyInputValue(params.saldoFGTS),
    feriasVencidasPeriodos: parseNumberInput(params.feriasVencidasPeriodos),
    adicionalTempoServicoPercentual: parseNumberInput(params.adicionalTempoServicoPercentual),
    adicionalTempoServicoValor: parseCurrencyInputValue(params.adicionalTempoServicoValor),
  }), [params]);

  const requestIsValid = Boolean(
    params.dataAdmissao
    && params.dataDemissao
    && tiposRescisao.some((tipo) => tipo.id === params.tipo),
  );

  const query = useQuery({
    queryKey: ['simulacoes', 'rescisao', request],
    queryFn: () => calcularRescisao(request),
    enabled: requestIsValid,
    staleTime: 15_000,
  });

  return {
    params,
    setParams,
    tiposRescisao,
    resultado: requestIsValid ? query.data?.resultado ?? EMPTY_RESULTADO_RESCISAO : EMPTY_RESULTADO_RESCISAO,
    envelope: requestIsValid ? query.data : undefined,
    isCalculating: parametrosQuery.isFetching || query.isFetching,
    error: parametrosQuery.error instanceof Error
      ? parametrosQuery.error.message
      : query.error instanceof Error
        ? query.error.message
        : '',
  };
}
