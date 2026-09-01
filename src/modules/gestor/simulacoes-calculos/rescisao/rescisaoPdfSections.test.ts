import { describe, expect, it } from 'vitest';
import { EMPTY_RESULTADO_RESCISAO } from './rescisaoService';
import type { RescisaoParams } from './rescisaoTypes';
import { buildRescisaoPdfSections } from './rescisaoPdfSections';

const params: RescisaoParams = {
  tipo: 'sem_justa_causa',
  avisoPrevioModo: 'indenizado',
  salario: '3.500,00',
  dataAdmissao: '2022-01-01',
  dataDemissao: '2026-08-31',
  saldoFGTS: '8.500,00',
  feriasVencidasPeriodos: '0',
  feriasVencidasEmDobro: false,
  adicionalTempoServicoAtivo: false,
  adicionalTempoServicoTipo: 'trienio',
  adicionalTempoServicoPercentual: '3',
  adicionalTempoServicoValor: '0,00',
};

describe('seções do PDF de rescisão', () => {
  it('usa o rótulo tenant-wide configurado para o motivo selecionado', () => {
    const sections = buildRescisaoPdfSections(
      params,
      EMPTY_RESULTADO_RESCISAO,
      undefined,
      'Dispensa sem justa causa personalizada',
    );

    expect(sections[0].rows[0]).toEqual({
      label: 'Motivo da rescisão',
      value: 'Dispensa sem justa causa personalizada',
    });
  });
});
