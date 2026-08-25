import { parseCurrencyInputValue } from '../../shared/currencyInputUtils';
import { formatCurrency } from '../services/calculos.service';
import type { AbaCalculo } from '../hooks/useSimulacoesCalculos';
import type { SimulationPdfSection } from './simulationPdfTypes';

type PdfData = Record<string, any>;

const moneyInput = (value: string) => formatCurrency(parseCurrencyInputValue(value));
const dateBr = (value: string) => {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : value || 'Não informado';
};
const row = (label: string, value: unknown) => ({ label, value: String(value ?? '—') });
const moneyRow = (label: string, value: number) => row(label, formatCurrency(value || 0));
const section = (title: string, rows: SimulationPdfSection['rows']): SimulationPdfSection => ({ title, rows });

export const buildLegacyPdfSections = (_abaAtiva: AbaCalculo, data: PdfData): SimulationPdfSection[] => {
  const p = data.params || {};
  const r = data.resultado || {};

  return [
    section('Parâmetros informados', [
      row('Motivo da rescisão', String(p.tipo || '').replaceAll('_', ' ')),
      row('Aviso prévio', String(p.avisoPrevioModo || '').replaceAll('_', ' ')),
      row('Admissão', dateBr(p.dataAdmissao)),
      row('Desligamento', dateBr(p.dataDemissao)),
      row('Salário informado', moneyInput(p.salario || '0')),
      moneyRow('Base de cálculo', r.salarioBaseCalculo),
      row('Saldo FGTS informado', moneyInput(p.saldoFGTS || '0')),
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
      moneyRow('Multa FGTS (conta vinculada)', r.multaFGTS),
      moneyRow('FGTS rescisório estimado', r.fgtsRescisorio),
      moneyRow('INSS estimado', r.inssRescisao),
      moneyRow('IRRF estimado', r.irrfRescisao),
      moneyRow('Aviso prévio descontado', r.avisoPrevioDesconto),
    ]),
    section('Resumo', [
      moneyRow('Total bruto', r.totalBruto),
      moneyRow('Total de descontos', r.totalDescontos),
      moneyRow('Líquido estimado das verbas do TRCT', r.totalLiquido),
    ]),
  ];
};
