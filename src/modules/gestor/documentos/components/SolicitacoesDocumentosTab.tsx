import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, ClipboardList, Plus, RefreshCw, X } from 'lucide-react';
import { useDocumentRequestOptions, useDocumentRequests } from '../hooks/useDocumentRequests';
import {
  DOCUMENT_REQUEST_STATUSES,
  type CreateDocumentRequestInput,
  type DocumentRequestStatus,
} from '../services/documentRequestService';
import '../styles/DocumentRequests.css';
import { DocumentRequestLifecycleAction } from './DocumentRequestLifecycleAction';

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getTodayKey = () => {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
};

const createEmptyForm = (): CreateDocumentRequestInput => ({
  clienteId: '',
  competencia: getCurrentMonth(),
  titulo: '',
  descricao: '',
  dataLimite: '',
  responsavelId: '',
  revisorId: '',
  tarefaId: '',
});

const formatMonth = (month: string) => new Date(`${month}-01T12:00:00`)
  .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

const formatDate = (date: string) => date
  ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR')
  : 'Sem prazo definido';

const STATUS_CLASS: Record<DocumentRequestStatus, string> = {
  Pendente: 'status-pendente',
  Recebido: 'status-recebido',
  'Em conferência': 'status-conferencia',
  Concluído: 'status-concluido',
  Cancelado: 'status-cancelado',
};

export const SolicitacoesDocumentosTab: React.FC = () => {
  const {
    requests,
    clients,
    canCreate,
    isLoading,
    isError,
    errorMessage,
    createRequest,
    isCreating,
    transitionRequest,
    updatingRequestId,
    updateError,
    retry,
  } = useDocumentRequests();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateDocumentRequestInput>(createEmptyForm);
  const [clientFilter, setClientFilter] = useState('Todos');
  const [competenceFilter, setCompetenceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentRequestStatus | 'Todos'>('Todos');
  const [feedback, setFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const formOptions = useDocumentRequestOptions(
    form.clienteId,
    form.competencia,
    showForm && Boolean(form.clienteId),
  );

  const clientNames = useMemo(() => new Map(clients.map((client) => [client.id, client.nome])), [clients]);
  const activeClients = useMemo(() => clients.filter((client) => client.status === 'Ativa'), [clients]);
  const filteredRequests = useMemo(() => requests.filter((request) => (
    (clientFilter === 'Todos' || request.clienteId === clientFilter)
    && (!competenceFilter || request.competencia === competenceFilter)
    && (statusFilter === 'Todos' || request.status === statusFilter)
  )), [clientFilter, competenceFilter, requests, statusFilter]);
  const totals = useMemo(() => Object.fromEntries(DOCUMENT_REQUEST_STATUSES.map((status) => [
    status,
    requests.filter((request) => request.status === status).length,
  ])) as Record<DocumentRequestStatus, number>, [requests]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError('');
    setFeedback('');
    if (!canCreate) {
      setActionError('Seu perfil não possui permissão para criar solicitações.');
      return;
    }
    try {
      await createRequest(form);
      setForm(createEmptyForm());
      setShowForm(false);
      setFeedback('Solicitação criada e incluída na competência selecionada.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível criar a solicitação.');
    }
  };

  const handleTransition = async (input: Parameters<typeof transitionRequest>[0]) => {
    setActionError('');
    setFeedback('');
    try {
      await transitionRequest(input);
      setFeedback(`Andamento atualizado para ${input.status}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível atualizar o status.');
      throw error;
    }
  };

  if (isLoading) {
    return <div className="document-request-state" role="status">Carregando solicitações...</div>;
  }

  if (isError) {
    return (
      <div className="document-request-state document-request-state--error" role="alert">
        <AlertTriangle size={20} aria-hidden />
        <div>
          <strong>Não foi possível carregar as solicitações.</strong>
          <p>{errorMessage || 'Verifique sua conexão e tente novamente.'}</p>
        </div>
        <button type="button" onClick={() => { void retry(); }}><RefreshCw size={15} /> Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="document-requests-page animate-fade-in">
      <header className="document-requests-header">
        <div>
          <span className="document-requests-eyebrow">Operação por competência</span>
          <h2>Solicitações de documentos</h2>
          <p>Registre o que cada cliente precisa enviar e acompanhe a conferência até a conclusão.</p>
        </div>
        <button
          type="button"
          className="document-request-primary"
          onClick={() => setShowForm((current) => !current)}
          disabled={!canCreate || activeClients.length === 0}
          title={!canCreate ? 'Seu perfil não possui permissão para criar solicitações.' : undefined}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Fechar formulário' : 'Nova solicitação'}
        </button>
      </header>

      {!canCreate && (
        <div className="document-request-state" role="status">
          Seu perfil não cria solicitações. Itens atribuídos a você continuam exibindo as ações permitidas.
        </div>
      )}

      {canCreate && activeClients.length === 0 && (
        <div className="document-request-state" role="status">
          Cadastre ao menos uma empresa cliente ativa antes de criar solicitações.
        </div>
      )}

      {showForm && canCreate && activeClients.length > 0 && (
        <section className="document-request-form-card" aria-labelledby="new-document-request-title">
          <div>
            <h3 id="new-document-request-title">Nova solicitação</h3>
            <p>Informe a empresa, a competência e o documento esperado.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <label>
              Empresa cliente
              <select
                required
                value={form.clienteId}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  clienteId: event.target.value,
                  responsavelId: '',
                  revisorId: '',
                  tarefaId: '',
                }))}
              >
                <option value="">Selecione</option>
                {activeClients.map((client) => <option key={client.id} value={client.id}>{client.nome}</option>)}
              </select>
            </label>
            <label>
              Competência
              <input
                type="month"
                required
                aria-label="Competência da solicitação"
                value={form.competencia}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  competencia: event.target.value,
                  tarefaId: '',
                }))}
              />
            </label>
            <label>
              Data limite
              <input
                type="date"
                required
                value={form.dataLimite}
                onChange={(event) => setForm((current) => ({ ...current, dataLimite: event.target.value }))}
              />
            </label>
            <label>
              Responsável
              <select
                required
                disabled={formOptions.isFetching || formOptions.isError}
                value={form.responsavelId}
                onChange={(event) => setForm((current) => ({ ...current, responsavelId: event.target.value }))}
              >
                <option value="">Selecione</option>
                {(formOptions.data?.users || []).map((user) => <option key={user.id} value={user.id}>{user.nome}</option>)}
              </select>
            </label>
            <label>
              Revisor (opcional)
              <select
                disabled={formOptions.isFetching || formOptions.isError}
                value={form.revisorId}
                onChange={(event) => setForm((current) => ({ ...current, revisorId: event.target.value }))}
              >
                <option value="">Sem revisor</option>
                {(formOptions.data?.users || []).filter((user) => user.id !== form.responsavelId)
                  .map((user) => <option key={user.id} value={user.id}>{user.nome}</option>)}
              </select>
            </label>
            <label>
              Atividade vinculada (opcional)
              <select
                disabled={formOptions.isFetching || formOptions.isError}
                value={form.tarefaId}
                onChange={(event) => setForm((current) => ({ ...current, tarefaId: event.target.value }))}
              >
                <option value="">Sem vínculo</option>
                {(formOptions.data?.tasks || []).map((task) => <option key={task.id} value={task.id}>{task.titulo}</option>)}
              </select>
            </label>
            <label className="document-request-form-wide">
              Documento solicitado
              <input
                required
                maxLength={160}
                placeholder="Ex.: Extratos bancários do mês"
                value={form.titulo}
                onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))}
              />
            </label>
            {formOptions.isFetching && (
              <div className="document-request-form-wide document-request-options-state" role="status">
                Carregando responsáveis e atividades disponíveis...
              </div>
            )}
            {formOptions.isError && (
              <div className="document-request-form-wide document-request-options-state is-error" role="alert">
                Não foi possível carregar responsáveis e atividades.
                <button type="button" onClick={() => { void formOptions.refetch(); }}>Tentar novamente</button>
              </div>
            )}
            <label className="document-request-form-wide">
              Orientações para o cliente (opcional)
              <textarea
                maxLength={2000}
                rows={3}
                placeholder="Formato, período ou observação necessária para a conferência."
                value={form.descricao}
                onChange={(event) => setForm((current) => ({ ...current, descricao: event.target.value }))}
              />
            </label>
            <div className="document-request-form-actions">
              <button type="button" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="document-request-primary" disabled={isCreating || formOptions.isFetching || formOptions.isError}>
                {isCreating ? 'Salvando...' : 'Criar solicitação'}
              </button>
            </div>
          </form>
        </section>
      )}

      {(feedback || actionError || updateError) && (
        <div className={`document-request-feedback ${actionError || updateError ? 'is-error' : ''}`} role={actionError || updateError ? 'alert' : 'status'}>
          {actionError || updateError || feedback}
        </div>
      )}

      <section className="document-request-summary" aria-label="Resumo das solicitações">
        {DOCUMENT_REQUEST_STATUSES.map((status) => (
          <article key={status} className={`document-request-summary-card ${STATUS_CLASS[status]}`}>
            <span>{status}</span>
            <strong>{totals[status]}</strong>
          </article>
        ))}
      </section>

      <section className="document-request-filters" aria-label="Filtros de solicitações">
        <label>
          Empresa
          <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
            <option value="Todos">Todas</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.nome}{client.status === 'Inativa' ? ' (Inativa)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Competência
          <input
            type="month"
            aria-label="Filtrar por competência"
            value={competenceFilter}
            onChange={(event) => setCompetenceFilter(event.target.value)}
          />
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DocumentRequestStatus | 'Todos')}>
            <option value="Todos">Todos</option>
            {DOCUMENT_REQUEST_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        {(clientFilter !== 'Todos' || competenceFilter || statusFilter !== 'Todos') && (
          <button type="button" onClick={() => { setClientFilter('Todos'); setCompetenceFilter(''); setStatusFilter('Todos'); }}>
            Limpar filtros
          </button>
        )}
      </section>

      {filteredRequests.length === 0 ? (
        <div className="document-request-empty">
          <ClipboardList size={30} aria-hidden />
          <strong>{requests.length === 0 ? 'Nenhuma solicitação criada' : 'Nenhuma solicitação encontrada'}</strong>
          <p>{requests.length === 0 ? 'Crie a primeira solicitação para começar o acompanhamento por cliente e competência.' : 'Ajuste ou limpe os filtros para ver outros registros.'}</p>
          {requests.length === 0 && canCreate && activeClients.length > 0 && (
            <button type="button" className="document-request-primary" onClick={() => setShowForm(true)}>
              <Plus size={15} /> Criar primeira solicitação
            </button>
          )}
        </div>
      ) : (
        <div className="document-request-list">
          {filteredRequests.map((request) => {
            const isOverdue = Boolean(request.dataLimite)
              && request.dataLimite < getTodayKey()
              && request.status !== 'Concluído';
            return (
              <article className="document-request-row" key={request.id}>
                <div className="document-request-row-main">
                  <strong>{request.titulo}</strong>
                  <span>{clientNames.get(request.clienteId) || 'Empresa não encontrada'}</span>
                  {request.descricao && <p>{request.descricao}</p>}
                  <p>Responsável: {request.responsavelNome || 'Vínculo pendente'}</p>
                  {request.revisorNome && <p>Revisor: {request.revisorNome}</p>}
                  {request.tarefaTitulo && <p>Atividade: {request.tarefaTitulo}</p>}
                </div>
                <div className="document-request-row-meta">
                  <span><CalendarClock size={14} /> {formatMonth(request.competencia)}</span>
                  <span className={isOverdue ? 'is-overdue' : ''}>{formatDate(request.dataLimite)}</span>
                </div>
                <div className={`document-request-status-badge ${STATUS_CLASS[request.status]}`}>{request.status}</div>
                <DocumentRequestLifecycleAction
                  request={request}
                  disabled={updatingRequestId === request.id}
                  onTransition={handleTransition}
                />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
