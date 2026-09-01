import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck2, ListChecks, Plus, Search, ShieldCheck, Workflow } from 'lucide-react';
import { SystemToast, type SystemToastData } from '../../components/SystemToast';
import { ObrigacaoCard } from './components/ObrigacaoCard';
import { ObrigacaoEditorDrawer } from './components/ObrigacaoEditorDrawer';
import { ObrigacoesPagination } from './components/ObrigacoesPagination';
import { ObrigacaoStatusDialog } from './components/ObrigacaoStatusDialog';
import {
  OBRIGACAO_REGIMES,
  createEmptyObrigacao,
  duplicateObrigacao,
  type ObrigacaoModelo,
  type ObrigacaoModeloDraft,
  type ObrigacaoRegime,
} from './obrigacoes.types';
import { obrigacoesKeys, obrigacoesService } from './services/obrigacoesService';
import { paginateObrigacoes } from './obrigacoesPagination';
import './ObrigacoesPage.css';

type StatusFilter = 'todos' | 'ativos' | 'inativos';
const EMPTY_OBRIGACOES: ObrigacaoModelo[] = [];
const EMPTY_METRICS = { total: 0, ativos: 0, comPrazo: 0, etapas: 0 } as const;

const notify = (
  type: SystemToastData['type'],
  title: string,
  message: string,
): SystemToastData => ({ id: Date.now(), type, title, message });

export const ObrigacoesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const obrigacoesQuery = useQuery({
    queryKey: obrigacoesKeys.list(),
    queryFn: obrigacoesService.list,
    staleTime: 60_000,
  });
  const resumoQuery = useQuery({
    queryKey: obrigacoesKeys.summary(),
    queryFn: obrigacoesService.summary,
    staleTime: 60_000,
  });
  const [search, setSearch] = useState('');
  const [regime, setRegime] = useState<'todos' | ObrigacaoRegime>('todos');
  const [categoria, setCategoria] = useState('todas');
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [editing, setEditing] = useState<ObrigacaoModeloDraft | null>(null);
  const [editorError, setEditorError] = useState('');
  const [toast, setToast] = useState<SystemToastData | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<ObrigacaoModelo | null>(null);

  const invalidateDependentData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: obrigacoesKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['protocolos'] }),
      queryClient.invalidateQueries({ queryKey: ['atividades'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: obrigacoesService.save,
    onSuccess: async (saved) => {
      await invalidateDependentData();
      setEditing(null);
      setEditorError('');
      setUpdatingId(null);
      setStatusConfirmation(null);
      setToast(notify(
        'success',
        saved.ativo ? 'Obrigação salva' : 'Obrigação desativada',
        saved.ativo
          ? `${saved.nome} foi atualizada e já está disponível nas empresas compatíveis.`
          : `${saved.nome} foi desativada nas empresas vinculadas.`,
      ));
    },
    onError: (error: Error) => {
      setUpdatingId(null);
      if (editing) {
        setEditorError(error.message);
      } else {
        setToast(notify('error', 'Não foi possível atualizar', error.message));
      }
    },
  });

  const obrigacoes = obrigacoesQuery.data ?? EMPTY_OBRIGACOES;
  const categorias = useMemo(() => (
    Array.from(new Set(obrigacoes.map((item) => item.categoria))).sort((a, b) => (
      a.localeCompare(b, 'pt-BR')
    ))
  ), [obrigacoes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return obrigacoes.filter((item) => {
      const matchesTerm = !term || [item.nome, item.descricao, item.categoria, ...item.etapas]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(term));
      const matchesRegime = regime === 'todos' || item.regimes.includes(regime);
      const matchesCategory = categoria === 'todas' || item.categoria === categoria;
      const matchesStatus = status === 'todos'
        || (status === 'ativos' ? item.ativo : !item.ativo);
      return matchesTerm && matchesRegime && matchesCategory && matchesStatus;
    }).sort((left, right) => (
      Number(right.ativo) - Number(left.ativo)
      || left.ordem - right.ordem
      || left.nome.localeCompare(right.nome, 'pt-BR')
    ));
  }, [categoria, obrigacoes, regime, search, status]);

  const metrics = resumoQuery.data ?? EMPTY_METRICS;
  const isLoading = obrigacoesQuery.isLoading || resumoQuery.isLoading;
  const queryError = obrigacoesQuery.error ?? resumoQuery.error;

  const page = useMemo(
    () => paginateObrigacoes(filtered, currentPage),
    [currentPage, filtered],
  );

  const handleSave = async (draft: ObrigacaoModeloDraft) => {
    setEditorError('');
    await saveMutation.mutateAsync(draft).catch(() => undefined);
  };

  const executeToggleStatus = (item: ObrigacaoModelo) => {
    setUpdatingId(item.id);
    saveMutation.mutate({ ...item, ativo: !item.ativo });
  };

  const handleToggleStatus = (item: ObrigacaoModelo) => {
    if (item.ativo) {
      setStatusConfirmation(item);
      return;
    }
    executeToggleStatus(item);
  };

  const clearFilters = () => {
    setSearch('');
    setRegime('todos');
    setCategoria('todas');
    setStatus('todos');
    setCurrentPage(1);
  };

  return (
    <div className="submodule-content-card obrigacoes-page animate-fade-in">
      <SystemToast toast={toast} onClose={() => setToast(null)} />

      <header className="obrigacoes-page__header">
        <div>
          <span className="obrigacoes-page__eyebrow"><Workflow size={15} /> Central de fluxos</span>
          <h2 className="parametrizacao-page-title">Obrigações</h2>
          <p>Crie cada obrigação como um fluxo completo e defina em quais regimes ela se aplica.</p>
        </div>
        <button
          type="button"
          className="obrigacoes-page__new-button"
          disabled={saveMutation.isPending}
          onClick={() => { setEditorError(''); setEditing(createEmptyObrigacao()); }}
        >
          <Plus size={18} /> Nova obrigação
        </button>
      </header>

      <section className="obrigacoes-page__metrics" aria-label="Resumo das obrigações">
        <article><ListChecks size={19} /><span>Cadastradas</span><strong>{metrics.total}</strong></article>
        <article><ShieldCheck size={19} /><span>Disponíveis</span><strong>{metrics.ativos}</strong></article>
        <article><CalendarCheck2 size={19} /><span>Com vencimento</span><strong>{metrics.comPrazo}</strong></article>
        <article><Workflow size={19} /><span>Etapas ativas</span><strong>{metrics.etapas}</strong></article>
      </section>

      <section className="obrigacoes-page__filters" aria-label="Filtros das obrigações">
        <div className="obrigacoes-page__filter-field obrigacoes-page__search">
          <label className="obrigacoes-page__filter-label" htmlFor="obrigacoes-search">
            Buscar obrigação
          </label>
          <div className="obrigacoes-page__search-control">
            <Search size={17} aria-hidden="true" />
            <input
              id="obrigacoes-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por obrigação, categoria ou etapa..."
            />
          </div>
        </div>
        <div className="obrigacoes-page__filter-field">
          <label className="obrigacoes-page__filter-label" htmlFor="obrigacoes-regime">Regime</label>
          <select
            id="obrigacoes-regime"
            value={regime}
            onChange={(event) => {
              setRegime(event.target.value as typeof regime);
              setCurrentPage(1);
            }}
          >
            <option value="todos">Todos os regimes</option>
            {OBRIGACAO_REGIMES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="obrigacoes-page__filter-field">
          <label className="obrigacoes-page__filter-label" htmlFor="obrigacoes-categoria">Categoria</label>
          <select
            id="obrigacoes-categoria"
            value={categoria}
            onChange={(event) => {
              setCategoria(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="todas">Todas as categorias</option>
            {categorias.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="obrigacoes-page__filter-field">
          <label className="obrigacoes-page__filter-label" htmlFor="obrigacoes-status">Status</label>
          <select
            id="obrigacoes-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setCurrentPage(1);
            }}
          >
            <option value="todos">Todos</option>
            <option value="ativos">Disponíveis</option>
            <option value="inativos">Desativados</option>
          </select>
        </div>
      </section>

      <div className="obrigacoes-page__result-line">
        <strong>{filtered.length} {filtered.length === 1 ? 'obrigação encontrada' : 'obrigações encontradas'}</strong>
        {(search || regime !== 'todos' || categoria !== 'todas' || status !== 'todos') && (
          <button type="button" onClick={clearFilters}>Limpar filtros</button>
        )}
      </div>

      {isLoading && (
        <div className="obrigacoes-page__state">Carregando obrigações...</div>
      )}
      {!!queryError && (
        <div className="obrigacoes-page__state obrigacoes-page__state--error">
          <strong>Não foi possível carregar as obrigações.</strong>
          <span>{queryError instanceof Error ? queryError.message : 'Tente novamente.'}</span>
          <button
            type="button"
            onClick={() => { void Promise.all([obrigacoesQuery.refetch(), resumoQuery.refetch()]); }}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {!isLoading && !queryError && !filtered.length && (
        <div className="obrigacoes-page__state">
          <Workflow size={28} />
          <strong>Nenhuma obrigação com esses filtros</strong>
          <span>Ajuste a busca ou crie um novo fluxo.</span>
        </div>
      )}

      {!isLoading && !queryError && !!filtered.length && (
        <section className="obrigacoes-page__grid" aria-label="Catálogo de obrigações">
          {page.items.map((item) => (
            <ObrigacaoCard
              key={item.id}
              obrigacao={item}
              onEdit={() => { setEditorError(''); setEditing(item); }}
              onDuplicate={() => { setEditorError(''); setEditing(duplicateObrigacao(item)); }}
              onToggleStatus={() => handleToggleStatus(item)}
              isUpdating={saveMutation.isPending}
            />
          ))}
        </section>
      )}

      {!isLoading && !queryError && !!filtered.length && (
        <ObrigacoesPagination
          currentPage={page.currentPage}
          totalPages={page.totalPages}
          totalItems={filtered.length}
          firstItem={page.firstItem}
          lastItem={page.lastItem}
          onPageChange={setCurrentPage}
        />
      )}

      {editing && (
        <ObrigacaoEditorDrawer
          initialValue={editing}
          isSaving={saveMutation.isPending}
          error={editorError}
          onClose={() => { if (!saveMutation.isPending) setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {statusConfirmation && (
        <ObrigacaoStatusDialog
          obrigacao={statusConfirmation}
          isSaving={saveMutation.isPending && updatingId === statusConfirmation.id}
          onCancel={() => {
            if (!saveMutation.isPending) setStatusConfirmation(null);
          }}
          onConfirm={() => executeToggleStatus(statusConfirmation)}
        />
      )}
    </div>
  );
};
