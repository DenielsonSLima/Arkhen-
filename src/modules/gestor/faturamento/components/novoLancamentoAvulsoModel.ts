export type NovoLancamentoTipo = 'cobranca' | 'nfse' | 'nfseComCobranca';
export type MeioPagamento = 'Pix' | 'Boleto' | 'Ambos';

export const DIRECT_NFSE_UNAVAILABLE_MESSAGE =
  'NFS-e sem cobrança não pode ser gerada: este fluxo não possui backend fiscal direto.';

type ExecuteNovoLancamentoOptions<TCobranca extends { id: string }> = {
  tipo: NovoLancamentoTipo;
  createCobranca: () => Promise<TCobranca>;
  emitNfse: (cobrancaId: string) => Promise<string>;
};

export const executeNovoLancamento = async <TCobranca extends { id: string }>({
  tipo,
  createCobranca,
  emitNfse,
}: ExecuteNovoLancamentoOptions<TCobranca>): Promise<TCobranca & { nfseId?: string }> => {
  if (tipo === 'nfse') throw new Error(DIRECT_NFSE_UNAVAILABLE_MESSAGE);

  const cobranca = await createCobranca();
  if (tipo !== 'nfseComCobranca') return cobranca;

  const nfseId = await emitNfse(cobranca.id);
  return { ...cobranca, nfseId };
};

export const getTodayString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};
