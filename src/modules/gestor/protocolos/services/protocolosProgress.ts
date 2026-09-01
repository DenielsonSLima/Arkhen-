export interface FluxoOperacionalProgresso {
  clienteId: string;
  competencia: string;
  tarefasTotal: number;
  tarefasConcluidas: number;
  etapasTotal: number;
  etapasConcluidas: number;
  percentual: number;
}

type JsonRecord = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const asRecord = (value: unknown): JsonRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null
);

const boundedInteger = (value: unknown, maximum = Number.MAX_SAFE_INTEGER) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.round(value)));
};

const normalizeProgress = (value: unknown): FluxoOperacionalProgresso | null => {
  const item = asRecord(value);
  const clienteId = typeof item?.clienteId === 'string' ? item.clienteId.trim() : '';
  const competencia = typeof item?.competencia === 'string' ? item.competencia.trim() : '';
  const competenciaMatch = /^(\d{4})-(\d{2})$/.exec(competencia);
  const competenciaAno = Number(competenciaMatch?.[1]);
  const competenciaMes = Number(competenciaMatch?.[2]);
  if (
    !item
    || !UUID_PATTERN.test(clienteId)
    || !competenciaMatch
    || competenciaAno < 2000
    || competenciaAno > 2100
    || competenciaMes < 1
    || competenciaMes > 12
  ) return null;

  const etapasTotal = boundedInteger(item.etapasTotal);
  const etapasConcluidas = Math.min(etapasTotal, boundedInteger(item.etapasConcluidas));
  const tarefasTotal = boundedInteger(item.tarefasTotal);
  const tarefasConcluidas = Math.min(tarefasTotal, boundedInteger(item.tarefasConcluidas));

  return {
    clienteId,
    competencia,
    tarefasTotal,
    tarefasConcluidas,
    etapasTotal,
    etapasConcluidas,
    percentual: boundedInteger(item.percentual, 100),
  };
};

export const normalizeFluxosOperacionais = (value: unknown) => {
  if (!Array.isArray(value)) return new Map<string, FluxoOperacionalProgresso>();

  const result = new Map<string, FluxoOperacionalProgresso>();
  value.forEach((entry) => {
    const progress = normalizeProgress(entry);
    if (progress) result.set(`${progress.clienteId}::${progress.competencia}`, progress);
  });
  return result;
};
