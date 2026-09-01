import { parseCurrencyInputValue } from '../../shared/currencyInputUtils';
import { formatCurrency, type ResultadoRescisao } from '../services/calculos.service';
import type { SimulationPdfSection } from '../pdf/simulationPdfTypes';
import type { RescisaoEnvelope } from './rescisaoService';
import type { RescisaoParams } from './rescisaoTypes';

const tipoLabels: Record<string, string> = {
  sem_justa_causa: 'Sem justa causa',
  com_justa_causa: 'Com justa causa',
  pedido_demissao: 'Pedido de demissão',
};

const avisoLabels: Record<string, string> = {
  cumprido: 'Cumprido',
  descontado: 'Não cumprido / descontado',
  indenizado: 'Indenizado',
};

const dateBr = (value: string) => {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value || 'Não informado';
};

const moneyRow = (label: string, value: number | undefined) => ({
  label,
  value: formatCurrency(value ?? 0),
});

export const buildRescisaoPdfSections = (
  params: RescisaoParams,
  resultado: ResultadoRescisao,
  envelope?: RescisaoEnvelope,
  tipoRescisaoLabel?: string,
): SimulationPdfSection[] => {
  const sections: SimulationPdfSection[] = [
    {
      title: 'Parâmetros informados',
      rows: [
        {
          label: 'Motivo da rescisão',
          value: tipoRescisaoLabel || tipoLabels[params.tipo] || params.tipo,
        },
        { label: 'Aviso prévio', value: avisoLabels[params.avisoPrevioModo] },
        { label: 'Admissão', value: dateBr(params.dataAdmissao) },
        { label: 'Desligamento', value: dateBr(params.dataDemissao) },
        moneyRow('Salário informado', parseCurrencyInputValue(params.salario)),
        moneyRow('Base de cálculo', resultado.salarioBaseCalculo),
        moneyRow('Saldo FGTS informado', parseCurrencyInputValue(params.saldoFGTS)),
        {
          label: 'Férias vencidas',
          value: `${params.feriasVencidasPeriodos || 0} período(s)${params.feriasVencidasEmDobro ? ' em dobro' : ''}`,
        },
      ],
    },
    {
      title: 'Demonstrativo das verbas',
      rows: [
        moneyRow('Adicional por tempo de serviço', resultado.adicionalTempoServico),
        moneyRow('Saldo de salário', resultado.saldoSalario),
        moneyRow('13º salário proporcional', resultado.decimoTerceiroProporcional),
        moneyRow('Férias proporcionais', resultado.feriasProporcionais),
        moneyRow('1/3 sobre férias proporcionais', resultado.adicionalFerias),
        moneyRow('Férias vencidas', resultado.feriasVencidas),
        moneyRow('1/3 sobre férias vencidas', resultado.adicionalFeriasVencidas),
        moneyRow('Aviso prévio indenizado', resultado.avisoPrevio),
        moneyRow('Multa FGTS (conta vinculada)', resultado.multaFGTS),
        moneyRow('FGTS rescisório estimado', resultado.fgtsRescisorio),
        moneyRow('INSS estimado', resultado.inssRescisao),
        moneyRow('IRRF estimado', resultado.irrfRescisao),
        moneyRow('Aviso prévio descontado', resultado.avisoPrevioDesconto),
      ],
    },
    {
      title: 'Resumo',
      rows: [
        moneyRow('Total bruto', resultado.totalBruto),
        moneyRow('Total de descontos', resultado.totalDescontos),
        moneyRow('Líquido estimado das verbas do TRCT', resultado.totalLiquido),
      ],
    },
  ];

  if (envelope?.memoriaCalculo.length) {
    sections.push({
      title: 'Memória de cálculo',
      rows: envelope.memoriaCalculo.map((item) => ({
        label: item.descricao,
        value: formatCurrency(item.valor),
      })),
    });
  }
  if (envelope?.alertas.length) {
    sections.push({
      title: 'Pontos de conferência',
      rows: envelope.alertas.map((alerta, index) => ({
        label: `Alerta ${index + 1}`,
        value: alerta,
      })),
    });
  }

  return sections;
};
