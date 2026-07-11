import { useMemo } from 'react';
import { bytesToGb, PLANOS_CONTRATACAO, type PlanoEmpresaResumo } from '../services/planosContratacaoService';
import { buildFileGroups, getUsageState } from '../utils/storagePresentation';

const DONUT_R = 60;
const DONUT_CIRC = 2 * Math.PI * DONUT_R;

export const useArmazenamentoContratacao = (resumo: PlanoEmpresaResumo | null | undefined) => {
  const planoAtual = resumo?.planoAtual || PLANOS_CONTRATACAO.find((plano) => plano.id === 'maximo')!;
  const groups = useMemo(() => buildFileGroups(resumo?.files || []), [resumo?.files]);

  const totalBytes = resumo?.totalBytes || 0;
  const limitBytes = planoAtual.armazenamentoGb * 1024 * 1024 * 1024;
  const freeBytes = Math.max(limitBytes - totalBytes, 0);
  const usedPercent = limitBytes > 0 ? Math.min((totalBytes / limitBytes) * 100, 100) : 0;
  const usageState = getUsageState(usedPercent);
  const companiesPercent = resumo ? Math.min((resumo.companyCount / planoAtual.empresas) * 100, 100) : 0;

  let cumulativeOffset = 0;
  const donutSlices = groups.map((group) => {
    const pct = totalBytes > 0 ? group.totalBytes / totalBytes : 0;
    const dash = pct * DONUT_CIRC;
    const gap = DONUT_CIRC - dash;
    const offset = DONUT_CIRC - cumulativeOffset;
    cumulativeOffset += dash;
    return { ...group, dash, gap, offset, pct };
  });

  return {
    planoAtual,
    groups,
    totalBytes,
    totalGb: bytesToGb(totalBytes),
    limitBytes,
    freeBytes,
    usedPercent,
    usageState,
    companiesPercent,
    donut: {
      radius: DONUT_R,
      slices: donutSlices,
    },
  };
};
