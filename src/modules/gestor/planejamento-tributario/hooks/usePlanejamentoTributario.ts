import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClienteEmpresa } from '../services/planejamento.types';
import {
  emptyComparativo,
  emptyDiagnostico,
  emptyEnquadramento,
  getPlanejamentoClientes,
  getPlanejamentoHistorico,
  rpc_calcularComparativoRegimes,
  rpc_consultarEnquadramentoSimples,
  rpc_gerarDiagnosticoTributario,
  salvarPlanejamento,
} from '../services/planejamento.service';
import { formatCurrencyInputValue, parseCurrencyInputValue } from '../../shared/currencyInputUtils';
import {
  DEFAULT_PARAMETROS_CALCULO,
  PARAMETROS_CALCULO_EVENT,
  parametrosCalculoService,
  type ParametrosCalculo,
} from '../../parametrizacao/parametros-calculo/services/parametrosCalculoService';

export type AbaAtiva = 'comparador' | 'analise' | 'legislacao' | 'historico';

const EMPTY_CLIENTE: ClienteEmpresa = {
  id: '', nome: 'Nenhum cliente ativo', cnpj: '', regimeAtual: 'Simples Nacional',
  faturamentoMensal: 0, faturamento12Meses: 0, folhaPagamentoMensal: 0,
  funcionarios: 0, anexoSimples: 'III', cnaeDescricao: 'Não informado',
};
const EMPTY_CLIENTES: ClienteEmpresa[] = [];

export function usePlanejamentoTributario() {
  const queryClient = useQueryClient();
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('comparador');
  const [parametrosCalculo, setParametrosCalculo] = useState<ParametrosCalculo>(DEFAULT_PARAMETROS_CALCULO);

  useEffect(() => {
    const loadParametros = () => { parametrosCalculoService.getParametros().then(setParametrosCalculo); };
    loadParametros();
    window.addEventListener(PARAMETROS_CALCULO_EVENT, loadParametros);
    return () => window.removeEventListener(PARAMETROS_CALCULO_EVENT, loadParametros);
  }, []);

  const clientesQuery = useQuery({
    queryKey: ['planejamento-tributario', 'clientes'],
    queryFn: getPlanejamentoClientes,
    staleTime: 30_000,
  });
  const clientes = clientesQuery.data ?? EMPTY_CLIENTES;

  const [faturamentoInput, setFaturamentoInput] = useState(formatCurrencyInputValue(500000));
  const [anexoInput, setAnexoInput] = useState('III');
  const faturamentoComparador = parseCurrencyInputValue(faturamentoInput);
  const comparativoQuery = useQuery({
    queryKey: ['planejamento-tributario', 'comparativo', faturamentoComparador, anexoInput],
    queryFn: () => rpc_calcularComparativoRegimes(faturamentoComparador, anexoInput),
  });

  const [clienteSelecionadoId, setClienteSelecionadoId] = useState('');
  useEffect(() => {
    if (!clienteSelecionadoId && clientes[0]) setClienteSelecionadoId(clientes[0].id);
  }, [clienteSelecionadoId, clientes]);
  const clienteSelecionado = clientes.find((cliente) => cliente.id === clienteSelecionadoId) ?? clientes[0] ?? EMPTY_CLIENTE;
  const analiseQuery = useQuery({
    queryKey: ['planejamento-tributario', 'analise', clienteSelecionado.id, clienteSelecionado.faturamento12Meses, clienteSelecionado.anexoSimples],
    queryFn: () => rpc_calcularComparativoRegimes(clienteSelecionado.faturamento12Meses, clienteSelecionado.anexoSimples ?? 'III'),
    enabled: Boolean(clienteSelecionado.id),
  });
  const analiseCliente = analiseQuery.data ?? emptyComparativo;
  const diagnosticoQuery = useQuery({
    queryKey: ['planejamento-tributario', 'diagnostico', clienteSelecionado.id, analiseCliente.regimeSugerido, analiseCliente.economiaEstimada],
    queryFn: () => rpc_gerarDiagnosticoTributario(clienteSelecionado, analiseCliente),
    enabled: Boolean(clienteSelecionado.id && analiseQuery.data),
  });

  const [consultaEmpresaId, setConsultaEmpresaId] = useState('manual');
  const [consultaFaturamentoInput, setConsultaFaturamentoInput] = useState(formatCurrencyInputValue(500000));
  const [anexoTabela, setAnexoTabela] = useState('III');
  const clienteConsulta = clientes.find((cliente) => cliente.id === consultaEmpresaId);
  const faturamentoConsulta = consultaEmpresaId === 'manual'
    ? parseCurrencyInputValue(consultaFaturamentoInput)
    : clienteConsulta?.faturamento12Meses ?? 0;
  const anexoConsulta = consultaEmpresaId === 'manual' ? anexoTabela : clienteConsulta?.anexoSimples ?? anexoTabela;
  const consultaQuery = useQuery({
    queryKey: ['planejamento-tributario', 'enquadramento', faturamentoConsulta, anexoConsulta],
    queryFn: () => rpc_consultarEnquadramentoSimples(faturamentoConsulta, anexoConsulta),
  });

  const anexosDas = useMemo(() => parametrosCalculo.anexosDas.filter((anexo) => anexo.ativo), [parametrosCalculo.anexosDas]);
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

  const historicoQuery = useQuery({
    queryKey: ['planejamento-tributario', 'historico'],
    queryFn: getPlanejamentoHistorico,
  });
  const salvarMutation = useMutation({
    mutationFn: ({ observacao }: { observacao?: string }) => salvarPlanejamento(clienteSelecionado.id, observacao),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planejamento-tributario', 'historico'] }),
  });

  return {
    status: clientesQuery.isLoading || comparativoQuery.isLoading ? 'Carregando dados' : 'Dados atualizados',
    abaAtiva, setAbaAtiva,
    faturamentoInput, setFaturamentoInput, anexoInput, setAnexoInput,
    comparativo: comparativoQuery.data ?? emptyComparativo, anexosDas,
    clientes, clienteSelecionadoId, setClienteSelecionadoId, clienteSelecionado,
    analiseCliente, diagnosticoCliente: diagnosticoQuery.data ?? emptyDiagnostico,
    salvarAnalise: async (observacao?: string) => salvarMutation.mutateAsync({ observacao }),
    salvandoAnalise: salvarMutation.isPending,
    consultaEmpresaId, setConsultaEmpresaId, consultaFaturamentoInput, setConsultaFaturamentoInput,
    consultaEnquadramento: consultaQuery.data ?? emptyEnquadramento,
    anexoTabela, setAnexoTabela, faixasExibidas,
    historico: historicoQuery.data ?? [],
  };
}
