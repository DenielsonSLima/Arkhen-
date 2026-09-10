import { useState } from 'react';
import { useRecorrenciaExecucoes, useRecorrenciaMutations } from '../queries/useRecorrenciaQueries';

const statuses: Record<string, string> = {
  pendente: 'Aguardando processamento', processando: 'Em processamento', erro: 'Precisa de atenção',
  aguardando_pagamento: 'Aguardando pagamento', aguardando_revisao: 'Rascunho para revisar', concluida: 'Concluída',
};
const stages: Record<string, string> = { cobranca: 'Cobrança', rascunho: 'Preparação da NFS-e', fiscal: 'NFS-e', concluida: 'Finalizada' };
export function RecorrenciaExecucoes({ contratoId }: { contratoId?: string }) {
  const query = useRecorrenciaExecucoes(contratoId);
  const mutations = useRecorrenciaMutations();
  const [error, setError] = useState('');
  const run = async (id: string) => {
    setError('');
    try { await mutations.run.mutateAsync(id); } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao retomar execução.');
    }
  };
  return <section className="faturamento-card">
    <h3>Execuções por competência</h3>
    <p>Acompanhe cada mensalidade. Retomar usa a mesma cobrança e o mesmo RPS; notas em revisão ficam no histórico de NFS-e.</p>
    {query.isLoading && <p>Carregando execuções...</p>}
    {query.isError && <p role="alert">Não foi possível carregar as execuções. <button className="faturamento-btn-secondary" onClick={() => void query.refetch()}>Tentar novamente</button></p>}
    {error && <p role="alert" className="faturamento-error-message">{error}</p>}
    {query.data?.length === 0 && <p>Nenhuma competência processada. Contratos anteriores precisam de configuração para ativar o agendamento.</p>}
    {!!query.data?.length && <div className="faturamento-table-container"><table className="faturamento-table">
      <thead><tr><th>Competência</th><th>Etapa</th><th>Situação</th><th>Ação</th></tr></thead>
      <tbody>{query.data.map(item => <tr key={item.id}>
        <td>{item.competencia.slice(0, 7).split('-').reverse().join('/')}</td>
        <td>{stages[item.etapa] || item.etapa}</td>
        <td>{statuses[item.status] || item.status}{item.mensagem && <small style={{ display: 'block' }}>{item.mensagem}</small>}
          {item.nfseId && <small style={{ display: 'block' }}>NFS-e {item.nfseId}</small>}</td>
        <td>{['pendente', 'erro', 'aguardando_pagamento'].includes(item.status)
          ? <button className="faturamento-btn-secondary" disabled={mutations.run.isPending} onClick={() => void run(item.id)}>{mutations.run.isPending ? 'Processando...' : 'Retomar execução'}</button>
          : item.status === 'aguardando_revisao' ? 'Revise no histórico de NFS-e' : '—'}</td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
