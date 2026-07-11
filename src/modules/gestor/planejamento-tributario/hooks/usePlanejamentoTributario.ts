import { useEffect, useMemo, useState } from 'react';
import {
  MOCK_CLIENTES,
  MOCK_HISTORICO,
} from '../services/planejamento.mock';
import {
  rpc_calcularComparativoRegimes,
  rpc_consultarEnquadramentoSimples,
  type ComparativoRegimes,
} from '../services/planejamento.service';
import { formatCurrencyInputValue, parseCurrencyInputValue } from '../../shared/currencyInputUtils';
import {
  DEFAULT_PARAMETROS_CALCULO,
  PARAMETROS_CALCULO_EVENT,
  parametrosCalculoService,
  type ParametrosCalculo,
} from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

export type AbaAtiva = 'comparador' | 'analise' | 'legislacao' | 'historico';

export function usePlanejamentoTributario() {
  const status = 'Em desenvolvimento';
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('comparador');
  const [parametrosCalculo, setParametrosCalculo] = useState<ParametrosCalculo>(DEFAULT_PARAMETROS_CALCULO);

  useEffect(() => {
    const loadParametros = () => {
      parametrosCalculoService.getParametros().then(setParametrosCalculo);
    };

    loadParametros();
    window.addEventListener(PARAMETROS_CALCULO_EVENT, loadParametros);
    return () => window.removeEventListener(PARAMETROS_CALCULO_EVENT, loadParametros);
  }, []);

  // Comparador
  const [faturamentoInput, setFaturamentoInput] = useState<string>(formatCurrencyInputValue(500000));
  const [anexoInput, setAnexoInput] = useState<string>('III');
  const comparativo = useMemo<ComparativoRegimes>(() => {
    const valor = parseCurrencyInputValue(faturamentoInput);
    return rpc_calcularComparativoRegimes(valor, anexoInput, parametrosCalculo.anexosDas);
  }, [faturamentoInput, anexoInput, parametrosCalculo.anexosDas]);

  // Análise por cliente
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>(MOCK_CLIENTES[0].id);
  const clienteSelecionado = useMemo(
    () => MOCK_CLIENTES.find((c) => c.id === clienteSelecionadoId) ?? MOCK_CLIENTES[0],
    [clienteSelecionadoId],
  );
  const analiseCliente = useMemo(
    () => rpc_calcularComparativoRegimes(
      clienteSelecionado.faturamento12Meses,
      clienteSelecionado.anexoSimples ?? 'III',
      parametrosCalculo.anexosDas,
    ),
    [clienteSelecionado, parametrosCalculo.anexosDas],
  );

  // Legislação e regras tributárias
  const [consultaEmpresaId, setConsultaEmpresaId] = useState<string>(MOCK_CLIENTES[0].id);
  const [consultaFaturamentoInput, setConsultaFaturamentoInput] = useState<string>(formatCurrencyInputValue(MOCK_CLIENTES[0].faturamento12Meses));
  const [anexoTabela, setAnexoTabela] = useState<string>(MOCK_CLIENTES[0].anexoSimples ?? 'III');
  const anexosDas = useMemo(() => parametrosCalculo.anexosDas.filter((anexo) => anexo.ativo), [parametrosCalculo.anexosDas]);
  const clienteConsulta = useMemo(
    () => MOCK_CLIENTES.find((cliente) => cliente.id === consultaEmpresaId),
    [consultaEmpresaId],
  );
  const faturamentoConsulta = consultaEmpresaId === 'manual'
    ? parseCurrencyInputValue(consultaFaturamentoInput)
    : clienteConsulta?.faturamento12Meses ?? parseCurrencyInputValue(consultaFaturamentoInput);
  const anexoConsulta = consultaEmpresaId === 'manual'
    ? anexoTabela
    : clienteConsulta?.anexoSimples ?? anexoTabela;
  const consultaEnquadramento = useMemo(() => rpc_consultarEnquadramentoSimples(
    faturamentoConsulta,
    anexoConsulta,
    parametrosCalculo.anexosDas,
  ), [faturamentoConsulta, anexoConsulta, parametrosCalculo.anexosDas]);
  const faixasExibidas = useMemo(() => {
    const anexo = parametrosCalculo.anexosDas.find((item) => item.id === anexoConsulta);
    return anexo?.faixas.map((faixa, index) => ({
      faixa: faixa.faixa,
      limiteInferior: index === 0 ? 0 : anexo.faixas[index - 1].limiteSuperior + 0.01,
      limiteSuperior: faixa.limiteSuperior,
      aliquotaNominal: faixa.aliquota,
      valorDeduzir: faixa.deducao,
    })) ?? [];
  }, [anexoConsulta, parametrosCalculo.anexosDas]);

  return {
    status,
    abaAtiva,
    setAbaAtiva,
    // Comparador
    faturamentoInput,
    setFaturamentoInput,
    anexoInput,
    setAnexoInput,
    comparativo,
    anexosDas,
    // Análise
    clientes: MOCK_CLIENTES,
    clienteSelecionadoId,
    setClienteSelecionadoId,
    clienteSelecionado,
    analiseCliente,
    // Legislação
    consultaEmpresaId,
    setConsultaEmpresaId,
    consultaFaturamentoInput,
    setConsultaFaturamentoInput,
    consultaEnquadramento,
    anexoTabela,
    setAnexoTabela,
    faixasExibidas,
    // Histórico
    historico: MOCK_HISTORICO,
  };
}
