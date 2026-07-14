import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatCurrencyInputValue, parseCurrencyInputValue } from '../../shared/currencyInputUtils';
import type { CarneLeaoParams, IrpfParams, LucrosDividendosParams, ResultadoCarneLeao, ResultadoIrpf, ResultadoLucrosDividendos } from '../pessoa-fisica';
import type { ResultadoSimulacaoGanhoCapital, SimulacaoGanhoCapitalParams } from '../ganho-capital';
import type { ResultadoSimulacaoMei, SimulacaoMeiParams } from '../mei';
import { RECEITAS_MENSAIS_MEI_VAZIAS } from '../mei/types';
import { calcularSimulacaoAvancada, type SimulacaoAvancada, versoesComoTexto } from '../services/simulacoesAvancadasService';

const moeda = (valor = 0) => formatCurrencyInputValue(valor);
const numero = (valor: string) => Number(valor.replace(',', '.')) || 0;
const hoje = new Date().toISOString().slice(0, 10);
const competenciaAtual = hoje.slice(0, 7);

export function useSimulacoesAvancadas(abaAtiva: string) {
  const [carneLeaoParams, setCarneLeaoParams] = useState<CarneLeaoParams>({
    competencia: competenciaAtual, tipoAtividade: 'autonomo', rendimentosPessoaFisica: moeda(),
    rendimentosExterior: moeda(), alugueis: moeda(), previdenciaOficial: moeda(), quantidadeDependentes: '0',
    pensaoAlimenticia: moeda(), despesasLivroCaixa: moeda(), excessoLivroCaixaAnterior: moeda(), impostoPagoExterior: moeda(),
  });
  const [irpfParams, setIrpfParams] = useState<IrpfParams>({
    anoCalendario: hoje.slice(0, 4),
    rendimentosTributaveis: moeda(), rendimentosIsentos: moeda(), rendimentosExclusivos: moeda(),
    previdenciaOficial: moeda(), quantidadeDependentes: '0',
    despesasSaude: moeda(), despesasEducacao: moeda(), pensaoAlimenticia: moeda(), pgbl: moeda(), livroCaixa: moeda(),
    irrfPago: moeda(), carneLeaoPago: moeda(), impostoComplementarPago: moeda(), impostoPagoExterior: moeda(), ganhoCapitalPago: moeda(),
  });
  const [lucrosDividendosParams, setLucrosDividendosParams] = useState<LucrosDividendosParams>({
    competencia: competenciaAtual, regimeTributario: 'simples_anexo_iii', aliquotaCpp: '20', proLabore: moeda(), proLaboreAlternativo: moeda(), proLaboreAcumuladoAno: moeda(),
    lucroDisponivelComprovado: moeda(), lucroContabilComprovado: false, dividendosNoMes: moeda(), dividendosAcumuladosAno: moeda(),
    outrosRendimentosAno: moeda(), participacaoSocietaria: '100',
  });
  const [ganhoCapitalParams, setGanhoCapitalParams] = useState<SimulacaoGanhoCapitalParams>({
    tipoBem: 'imovel', dataAquisicao: '', custoAquisicao: moeda(), benfeitorias: moeda(), valorVenda: moeda(),
    despesasAlienacao: moeda(), dataVenda: hoje, percentualParticipacao: '100', unicoImovelAte440Mil: false,
    semOutraAlienacaoImovel5Anos: false, totalAlienacoesMesMesmaNatureza: moeda(), reinvestimentoImovel180Dias: false,
    dataReinvestimento: '', valorReinvestido: moeda(), vendaParcelada: false, cronogramaParcelas: [],
  });
  const [meiParams, setMeiParams] = useState<SimulacaoMeiParams>({
    competencia: competenciaAtual, ano: hoje.slice(0, 4), dataAbertura: `${hoje.slice(0, 4)}-01-01`, tipoMei: 'normal', atividade: 'servico',
    receitasMensais: RECEITAS_MENSAIS_MEI_VAZIAS, quantidadeEmpregados: '0', possuiSocio: false, possuiFilial: false,
    ocupacaoCodigo: '',
  });

  const solicitacoes = useMemo<Record<SimulacaoAvancada, Record<string, unknown>>>(() => ({
    'carne-leao': {
      competencia: carneLeaoParams.competencia, tipoAtividade: carneLeaoParams.tipoAtividade,
      rendimentosPF: parseCurrencyInputValue(carneLeaoParams.rendimentosPessoaFisica),
      rendimentosExterior: parseCurrencyInputValue(carneLeaoParams.rendimentosExterior), alugueis: parseCurrencyInputValue(carneLeaoParams.alugueis),
      previdenciaOficial: parseCurrencyInputValue(carneLeaoParams.previdenciaOficial), dependentes: numero(carneLeaoParams.quantidadeDependentes),
      pensaoAlimenticia: parseCurrencyInputValue(carneLeaoParams.pensaoAlimenticia), livroCaixa: parseCurrencyInputValue(carneLeaoParams.despesasLivroCaixa),
      excessoLivroCaixaAnterior: parseCurrencyInputValue(carneLeaoParams.excessoLivroCaixaAnterior), impostoExterior: parseCurrencyInputValue(carneLeaoParams.impostoPagoExterior),
    },
    irpf: {
      ...Object.fromEntries(Object.entries(irpfParams).map(([chave, valor]) => [chave, chave === 'anoCalendario' ? valor : chave === 'quantidadeDependentes' ? numero(valor) : parseCurrencyInputValue(valor)])),
      impostoExterior: parseCurrencyInputValue(irpfParams.impostoPagoExterior),
    },
    'lucros-dividendos': {
      competencia: lucrosDividendosParams.competencia,
      regimeTributario: lucrosDividendosParams.regimeTributario,
      ...(lucrosDividendosParams.regimeTributario === 'simples_anexo_iv' && lucrosDividendosParams.aliquotaCpp.trim()
        ? { aliquotaCpp: numero(lucrosDividendosParams.aliquotaCpp) }
        : {}),
      prolabore: parseCurrencyInputValue(lucrosDividendosParams.proLabore), proLaboreAlternativo: parseCurrencyInputValue(lucrosDividendosParams.proLaboreAlternativo),
      lucroContabilDisponivel: parseCurrencyInputValue(lucrosDividendosParams.lucroDisponivelComprovado), dividendosMes: parseCurrencyInputValue(lucrosDividendosParams.dividendosNoMes),
      lucroContabilComprovado: lucrosDividendosParams.lucroContabilComprovado,
      dividendosAnoAntes: parseCurrencyInputValue(lucrosDividendosParams.dividendosAcumuladosAno), outrosRendimentosAno: parseCurrencyInputValue(lucrosDividendosParams.outrosRendimentosAno),
      participacaoPercentual: numero(lucrosDividendosParams.participacaoSocietaria),
      prolaboreAno: parseCurrencyInputValue(lucrosDividendosParams.proLaboreAcumuladoAno),
    },
    'ganho-capital': {
      ...ganhoCapitalParams, custoAquisicao: parseCurrencyInputValue(ganhoCapitalParams.custoAquisicao), benfeitorias: parseCurrencyInputValue(ganhoCapitalParams.benfeitorias),
      valorVenda: parseCurrencyInputValue(ganhoCapitalParams.valorVenda), despesasVenda: parseCurrencyInputValue(ganhoCapitalParams.despesasAlienacao),
      percentualPropriedade: numero(ganhoCapitalParams.percentualParticipacao), valorReinvestidoImovel180Dias: parseCurrencyInputValue(ganhoCapitalParams.valorReinvestido),
      reinvestimentoResidencialDentro180Dias: ganhoCapitalParams.reinvestimentoImovel180Dias,
      totalAlienacoesMesMesmaNatureza: parseCurrencyInputValue(ganhoCapitalParams.totalAlienacoesMesMesmaNatureza),
      cronogramaParcelas: ganhoCapitalParams.vendaParcelada
        ? ganhoCapitalParams.cronogramaParcelas.map((parcela) => ({ data: parcela.data, valor: parseCurrencyInputValue(parcela.valor) }))
        : [],
    },
    mei: {
      competencia: meiParams.competencia, anoReferencia: numero(meiParams.ano), anoAbertura: numero(meiParams.dataAbertura.slice(0, 4)),
      mesAbertura: numero(meiParams.dataAbertura.slice(5, 7)), tipoMei: meiParams.tipoMei, atividade: meiParams.atividade,
      receitasMensais: Object.values(meiParams.receitasMensais).map(parseCurrencyInputValue), quantidadeEmpregados: numero(meiParams.quantidadeEmpregados),
      possuiSocio: meiParams.possuiSocio, possuiFilial: meiParams.possuiFilial, ocupacaoCodigo: meiParams.ocupacaoCodigo,
    },
  }), [carneLeaoParams, ganhoCapitalParams, irpfParams, lucrosDividendosParams, meiParams]);

  const tipoAtivo = isAvancada(abaAtiva) ? abaAtiva : null;
  const query = useQuery({
    queryKey: ['simulacao-avancada', tipoAtivo, tipoAtivo ? solicitacoes[tipoAtivo] : null],
    queryFn: () => calcularSimulacaoAvancada<Record<string, unknown>>(tipoAtivo!, solicitacoes[tipoAtivo!]),
    enabled: tipoAtivo !== null,
  });
  const resultado = query.data ? { ...query.data.resultado, memoriaCalculo: query.data.memoriaCalculo ?? [], alertas: query.data.alertas ?? [], versaoParametros: versoesComoTexto(query.data.versoesParametros) } : null;
  const salvarHistoricoMutation = useMutation({
    mutationFn: async () => {
      if (!tipoAtivo) throw new Error('Selecione uma simulação de Pessoa Física ou MEI.');
      return calcularSimulacaoAvancada<Record<string, unknown>>(tipoAtivo, { ...solicitacoes[tipoAtivo], salvarHistorico: true });
    },
  });

  return {
    carneLeaoParams, setCarneLeaoParams, resultadoCarneLeao: tipoAtivo === 'carne-leao' ? resultado as unknown as ResultadoCarneLeao : null,
    irpfParams, setIrpfParams, resultadoIrpf: tipoAtivo === 'irpf' ? resultado as unknown as ResultadoIrpf : null,
    lucrosDividendosParams, setLucrosDividendosParams, resultadoLucrosDividendos: tipoAtivo === 'lucros-dividendos' ? resultado as unknown as ResultadoLucrosDividendos : null,
    ganhoCapitalParams, setGanhoCapitalParams, resultadoGanhoCapital: tipoAtivo === 'ganho-capital' ? resultado as unknown as ResultadoSimulacaoGanhoCapital : null,
    meiParams, setMeiParams, resultadoMei: tipoAtivo === 'mei' ? resultado as unknown as ResultadoSimulacaoMei : null,
    isCalculandoAvancada: query.isFetching,
    erroSimulacao: query.error instanceof Error ? query.error.message : '',
    salvarHistorico: salvarHistoricoMutation.mutate,
    salvandoHistorico: salvarHistoricoMutation.isPending,
    historicoSalvo: Boolean(salvarHistoricoMutation.data?.historicoId),
    erroHistorico: salvarHistoricoMutation.error instanceof Error ? salvarHistoricoMutation.error.message : '',
  };
}

function isAvancada(value: string): value is SimulacaoAvancada {
  return ['carne-leao', 'irpf', 'lucros-dividendos', 'ganho-capital', 'mei'].includes(value);
}
