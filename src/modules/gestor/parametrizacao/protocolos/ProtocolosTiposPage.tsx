import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FileText, Layers3, ListChecks, RotateCcw, Save } from 'lucide-react';
import {
  protocolosCatalogoKeys,
  protocolosCatalogoService,
  type ProtocoloTipoConfig,
  type ProtocoloOrigemPadrao,
} from '../../protocolos/services/protocolosCatalogoService';
import { prazosEntregaService, type RegimeEmpresa, type TipoFechamentoEntrega } from '../prazos-entrega/services/prazosEntregaService';
import './ProtocolosTiposPage.css';

type CatalogoView = 'Resumo' | 'Todos' | RegimeEmpresa;

const periodos: Array<{ value: TipoFechamentoEntrega; label: string }> = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
];

const categorias: Array<ProtocoloTipoConfig['categoria']> = ['Fiscal', 'Contábil', 'Trabalhista', 'Financeiro', 'Documentos', 'NF-e', 'NFC-e'];
const origens: Array<ProtocoloTipoConfig['origemPadrao']> = ['Cliente envia', 'Escritório envia', 'Ambos'];

export const ProtocolosTiposPage: React.FC = () => {
  const regimes = useMemo(() => prazosEntregaService.getRegimes(), []);
  const queryClient = useQueryClient();
  const catalogoQuery = useQuery({
    queryKey: protocolosCatalogoKeys.all,
    queryFn: protocolosCatalogoService.listCatalogoTodos,
    staleTime: 5 * 60 * 1000,
  });
  const saveMutation = useMutation({
    mutationFn: (items: ProtocoloTipoConfig[]) => protocolosCatalogoService.persistCatalogo(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: protocolosCatalogoKeys.all }),
  });
  const resetMutation = useMutation({
    mutationFn: protocolosCatalogoService.restoreCatalogo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: protocolosCatalogoKeys.all }),
  });
  const [activeFilter, setActiveFilter] = useState<CatalogoView>('Resumo');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<ProtocoloTipoConfig[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (catalogoQuery.data) {
      setCatalogo(catalogoQuery.data);
    }
  }, [catalogoQuery.data]);

  const filteredCatalogo = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return catalogo.filter((item) => {
      const matchesRegime = activeFilter === 'Resumo' || activeFilter === 'Todos' || item.regimes.includes(activeFilter);
      const matchesTerm = !term ||
        item.nome.toLowerCase().includes(term) ||
        item.descricao.toLowerCase().includes(term) ||
        item.categoria.toLowerCase().includes(term);
      return matchesRegime && matchesTerm;
    });
  }, [activeFilter, catalogo, searchTerm]);

  const summary = useMemo(() => {
    const ativos = catalogo.filter((item) => item.status === 'Ativo').length;
    const byCategoria = categorias.map((categoria) => ({
      categoria,
      total: catalogo.filter((item) => item.categoria === categoria).length,
    })).filter((item) => item.total > 0);

    const byRegime = regimes.map((regime) => ({
      regime,
      total: catalogo.filter((item) => item.regimes.includes(regime)).length,
    }));

    const byRotina = periodos.map((periodo) => ({
      label: periodo.label,
      total: catalogo.filter((item) => item.periodicidadePadrao === periodo.value).length,
    })).filter((item) => item.total > 0);

    return {
      total: catalogo.length,
      ativos,
      inativos: catalogo.length - ativos,
      byCategoria,
      byRegime,
      byRotina,
    };
  }, [catalogo, regimes]);

  const groupedCatalogo = useMemo(() => {
    return categorias
      .map((categoria) => ({
        categoria,
        items: filteredCatalogo.filter((item) => item.categoria === categoria),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredCatalogo]);

  useEffect(() => {
    if (activeFilter === 'Resumo') {
      return;
    }

    if (!filteredCatalogo.length) {
      setSelectedItemId(null);
      return;
    }

    if (!selectedItemId || !filteredCatalogo.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(filteredCatalogo[0].id);
    }
  }, [activeFilter, filteredCatalogo, selectedItemId]);

  const selectedItem = useMemo(() => (
    filteredCatalogo.find((item) => item.id === selectedItemId) ?? filteredCatalogo[0] ?? null
  ), [filteredCatalogo, selectedItemId]);

  const activeViewLabel = activeFilter === 'Todos' ? 'Todos os regimes' : activeFilter;

  const formatPeriodo = (value: TipoFechamentoEntrega) => (
    periodos.find((periodo) => periodo.value === value)?.label ?? value
  );

  const updateItem = (id: string, updates: Partial<ProtocoloTipoConfig>) => {
    setCatalogo((current) => current.map((item) => (
      item.id === id ? { ...item, ...updates } : item
    )));
  };

  const toggleRegime = (id: string, regime: RegimeEmpresa, checked: boolean) => {
    setCatalogo((current) => current.map((item) => {
      if (item.id !== id) return item;
      const regimesSet = new Set(item.regimes);
      if (checked) {
        regimesSet.add(regime);
      } else {
        regimesSet.delete(regime);
      }
      const nextRegimes = Array.from(regimesSet);
      if (!nextRegimes.length) {
        return item;
      }
      return { ...item, regimes: nextRegimes };
    }));
  };

  const handleSave = async () => {
    setErrorMsg('');
    try {
      const saved = await saveMutation.mutateAsync(catalogo);
      setCatalogo(saved);
      setSuccessMsg('Catálogo de obrigações salvo.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar catálogo no Supabase.');
    }
  };

  const handleReset = async () => {
    setErrorMsg('');
    try {
      const defaults = await resetMutation.mutateAsync();
      setCatalogo(defaults);
      setSuccessMsg('Catálogo padrão restaurado.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao restaurar catálogo no Supabase.');
    }
  };

  const isSaving = saveMutation.isPending || resetMutation.isPending;

  return (
    <div className="submodule-content-card protocolos-tipos-page animate-fade-in">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Catálogo de Obrigações e Protocolos</h2>
          <p>Cadastre e ajuste quais obrigações/documentos existem no escritório e a rotina padrão por regime.</p>
        </div>
        <div className="tab-buttons-header">
          <button className="btn-cancel" onClick={handleReset} disabled={isSaving}>
            <RotateCcw size={15} /> Restaurar
          </button>
          <button className="btn-add-user" onClick={handleSave} disabled={isSaving}>
            <Save size={15} /> {isSaving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {successMsg && <div className="success-banner" style={{ marginTop: 12 }}>{successMsg}</div>}
      {(errorMsg || catalogoQuery.error) && (
        <div className="form-alert-banner error" style={{ marginTop: 12 }}>
          {errorMsg || 'Erro ao carregar catálogo no Supabase.'}
        </div>
      )}

      <div className="protocolos-regime-filters" role="tablist" aria-label="Filtro por regime">
        <button
          className={`btn-tab ${activeFilter === 'Resumo' ? 'active' : ''}`}
          onClick={() => setActiveFilter('Resumo')}
        >
          <ListChecks size={15} /> Resumo
        </button>
        <button
          className={`btn-tab ${activeFilter === 'Todos' ? 'active' : ''}`}
          onClick={() => setActiveFilter('Todos')}
        >
          <CalendarClock size={15} /> Todos os regimes
        </button>
        {regimes.map((regime) => (
          <button
            key={regime}
            className={`btn-tab ${activeFilter === regime ? 'active' : ''}`}
            onClick={() => setActiveFilter(regime)}
          >
            <CalendarClock size={15} /> {regime}
          </button>
        ))}
      </div>

      {activeFilter === 'Resumo' ? (
        <div className="protocolos-resumo">
          {catalogoQuery.isLoading && (
            <div className="protocolos-empty-state large">
              Carregando catálogo no Supabase...
            </div>
          )}
          <div className="protocolos-resumo-metricas">
            <article>
              <FileText size={18} />
              <span>Total no catálogo</span>
              <strong>{summary.total}</strong>
            </article>
            <article>
              <ListChecks size={18} />
              <span>Ativos</span>
              <strong>{summary.ativos}</strong>
            </article>
            <article>
              <Layers3 size={18} />
              <span>Categorias usadas</span>
              <strong>{summary.byCategoria.length}</strong>
            </article>
            <article>
              <CalendarClock size={18} />
              <span>Inativos</span>
              <strong>{summary.inativos}</strong>
            </article>
          </div>

          <div className="protocolos-resumo-grid">
            <section className="protocolos-resumo-panel">
              <h3>Por categoria</h3>
              {summary.byCategoria.map((item) => (
                <div key={item.categoria} className="protocolos-resumo-row">
                  <span>{item.categoria}</span>
                  <strong>{item.total}</strong>
                </div>
              ))}
            </section>

            <section className="protocolos-resumo-panel">
              <h3>Por regime</h3>
              {summary.byRegime.map((item) => (
                <button
                  key={item.regime}
                  type="button"
                  className="protocolos-resumo-row protocolos-resumo-link"
                  onClick={() => setActiveFilter(item.regime)}
                >
                  <span>{item.regime}</span>
                  <strong>{item.total}</strong>
                </button>
              ))}
            </section>

            <section className="protocolos-resumo-panel">
              <h3>Rotinas padrão</h3>
              {summary.byRotina.map((item) => (
                <div key={item.label} className="protocolos-resumo-row">
                  <span>{item.label}</span>
                  <strong>{item.total}</strong>
                </div>
              ))}
            </section>
          </div>
        </div>
      ) : (
        <>
          <div className="protocolos-tipos-controls">
            <div className="parceiros-controls-bar">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nome, descrição ou categoria..."
              />
            </div>
          </div>

          <div className="protocolos-editor-layout">
            <aside className="protocolos-list-panel" aria-label="Obrigações do catálogo">
              <div className="protocolos-list-panel-head">
                <span>{activeViewLabel}</span>
                <strong>{filteredCatalogo.length} itens</strong>
              </div>

              {groupedCatalogo.length ? groupedCatalogo.map((group) => (
                <section key={group.categoria} className="protocolos-list-group">
                  <h3>{group.categoria}</h3>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`protocolos-list-button ${selectedItem?.id === item.id ? 'active' : ''}`}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <span className="protocolos-list-title">{item.nome}</span>
                      <span className="protocolos-list-meta">
                        {formatPeriodo(item.periodicidadePadrao)} · vence dia {item.diaLimite}
                      </span>
                      <span className="protocolos-list-footer">
                        <span>{item.regimes.length} regimes</span>
                        <span className={`protocolos-status-pill ${item.status === 'Ativo' ? 'active' : 'inactive'}`}>
                          {item.status}
                        </span>
                      </span>
                    </button>
                  ))}
                </section>
              )) : (
                <div className="protocolos-empty-state">
                  Nenhuma obrigação encontrada para este filtro.
                </div>
              )}
            </aside>

            <section className="protocolos-editor-panel">
              {selectedItem ? (
                <>
                  <div className="protocolos-editor-header">
                    <div>
                      <span>Edição selecionada</span>
                      <h3>{selectedItem.nome}</h3>
                      <p>
                        {selectedItem.categoria} · {formatPeriodo(selectedItem.periodicidadePadrao)} · vence dia {selectedItem.diaLimite}
                      </p>
                    </div>
                    <span className={`table-badge ${selectedItem.status === 'Ativo' ? 'badge-success' : 'badge-warning'}`}>
                      {selectedItem.status}
                    </span>
                  </div>

                  <div className="protocolos-editor-section">
                    <h4>Identificação</h4>
                    <div className="protocolos-editor-grid two-columns">
                      <label>
                        <span>Nome do protocolo</span>
                        <input
                          type="text"
                          value={selectedItem.nome}
                          onChange={(event) => updateItem(selectedItem.id, { nome: event.target.value })}
                        />
                      </label>
                      <label>
                        <span>Categoria</span>
                        <select
                          value={selectedItem.categoria}
                          onChange={(event) => updateItem(selectedItem.id, { categoria: event.target.value as ProtocoloTipoConfig['categoria'] })}
                        >
                          {categorias.map((categoria) => (
                            <option key={categoria} value={categoria}>{categoria}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="protocolos-editor-description">
                      <span>Descrição</span>
                      <textarea
                        value={selectedItem.descricao}
                        onChange={(event) => updateItem(selectedItem.id, { descricao: event.target.value })}
                      />
                    </label>
                  </div>

                  <div className="protocolos-editor-section">
                    <h4>Rotina padrão</h4>
                    <div className="protocolos-editor-grid three-columns">
                      <label>
                        <span>Dia vencimento</span>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={selectedItem.diaLimite}
                          onChange={(event) => updateItem(selectedItem.id, { diaLimite: Number(event.target.value) })}
                        />
                      </label>
                      <label>
                        <span>Periodicidade</span>
                        <select
                          value={selectedItem.periodicidadePadrao}
                          onChange={(event) => updateItem(selectedItem.id, { periodicidadePadrao: event.target.value as TipoFechamentoEntrega })}
                        >
                          {periodos.map((periodo) => (
                            <option key={periodo.value} value={periodo.value}>{periodo.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Origem padrão</span>
                        <select
                          value={selectedItem.origemPadrao}
                          onChange={(event) => updateItem(selectedItem.id, { origemPadrao: event.target.value as ProtocoloOrigemPadrao })}
                        >
                          {origens.map((origem) => (
                            <option key={`${selectedItem.id}-${origem}`} value={origem}>{origem}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="protocolos-editor-section">
                    <div className="protocolos-section-heading">
                      <h4>Regimes aplicados</h4>
                      <label className="protocolos-status-toggle">
                        <input
                          type="checkbox"
                          checked={selectedItem.status === 'Ativo'}
                          onChange={(event) => updateItem(selectedItem.id, { status: event.target.checked ? 'Ativo' : 'Inativo' })}
                        />
                        <span>{selectedItem.status === 'Ativo' ? 'Ativo' : 'Inativo'}</span>
                      </label>
                    </div>
                    <div className="protocolos-regimes-grid">
                      {regimes.map((regime) => (
                        <label key={`${selectedItem.id}-${regime}`}>
                          <input
                            type="checkbox"
                            checked={selectedItem.regimes.includes(regime)}
                            onChange={(event) => toggleRegime(selectedItem.id, regime, event.target.checked)}
                          />
                          <span>{regime}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="protocolos-empty-state large">
                  Selecione um filtro ou ajuste a busca para editar uma obrigação.
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};
