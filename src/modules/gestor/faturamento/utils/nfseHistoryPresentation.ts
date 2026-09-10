export const nfseStatusLabels: Record<string, string> = {
  rascunho: 'Rascunho', processando: 'Processando', rejeitada: 'Rejeitada', incerta: 'Resultado incerto',
  falha_pre_envio: 'Falha antes do envio', confirmada: 'Emitida', cancelada: 'Cancelada', substituida: 'Substituída',
};
export const formatNfseDate = (value?: string) => {
  if (!value) return 'Não informada';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR', { timeZone: 'America/Maceio' });
};
export const formatNfseCompetencia = (value?: string) => value ? value.replace(/^(\d{4})-(\d{2}).*$/, '$2/$1') : 'Não informada';
