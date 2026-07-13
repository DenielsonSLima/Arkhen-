import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  CheckCircle2,
  Palette,
  Settings2,
  Plus,
  ShieldAlert,
  Tags,
  UserRound,
  X,
} from 'lucide-react';
import { useAgenda } from './hooks/useAgenda';
import { useAgendaRealtime } from './hooks/useAgendaRealtime';
import { EventoCard } from './components/EventoCard';
import { EventoModal } from './components/EventoModal';
import { AgendaConfigListModal } from './components/AgendaConfigListModal';
import { AgendaResponsavelCorModal } from './components/AgendaResponsavelCorModal';
import { AgendaDeleteEventModal } from './components/AgendaDeleteEventModal';
import { PrazosAutomaticos } from './components/PrazosAutomaticos';
import { AgendaTrimestreAtividades } from './components/AgendaTrimestreAtividades';
import { getEventoOrigem, type Evento } from './services/agenda.service';
import { inicioService } from '../inicio/services/inicioService';
import './Agenda.css';

const RESUMO_FILTRO_LIMIT = 2;

type AgendaToast = {
  type: 'success' | 'error';
  message: string;
};

export const AgendaPage: React.FC = () => {
  useAgendaRealtime(true);

  const {
    anoAtual,
    mesAtual,
    filtro,
    setFiltro,
    categoriaFiltro,
    setCategoriaFiltro,
    funcionarioFiltro,
    setFuncionarioFiltro,
    empresaFiltro,
    setEmpresaFiltro,
    diaSelecionado,
    setDiaSelecionado,
    todosEventos,
    eventosFiltrados,
    eventosTrimestreFiltrados,
    eventosDoDia,
    navegarMes,
    modalAberto,
    setModalAberto,
    eventoEditando,
    handleSalvarEvento,
    handleAbrirNovoEvento,
    handleAbrirEdicao,
    handleExcluirEvento,
    empresas,
    usuarioAtual,
    usuariosAtribuiveis,
    usuariosAgenda,
    tiposEvento,
    categoriasEvento,
    handleSalvarTiposEventoConfig,
    handleSalvarCategoriasEventoConfig,
    handleSalvarResponsaveisAgendaConfig,
  } = useAgenda();

  const vencimentos = useMemo(() => inicioService.getVencimentosProximos(), []);
  const [filtroTipoAberto, setFiltroTipoAberto] = useState(false);
  const [filtroCategoriaAberto, setFiltroCategoriaAberto] = useState(false);
  const [modalGerenciarTipoAberto, setModalGerenciarTipoAberto] = useState(false);
  const [modalGerenciarCategoriaAberto, setModalGerenciarCategoriaAberto] = useState(false);
  const [modalCorResponsavelAberto, setModalCorResponsavelAberto] = useState(false);
  const [eventoParaExcluir, setEventoParaExcluir] = useState<Evento | null>(null);
  const [agendaToast, setAgendaToast] = useState<AgendaToast | null>(null);
  const tiposDisponiveis = useMemo(() => tiposEvento.filter((item) => item.ativo), [tiposEvento]);
  const categoriasDisponiveis = useMemo(() => categoriasEvento.filter((item) => item.ativo), [categoriasEvento]);

  useEffect(() => {
    if (!agendaToast) return;
    const timer = window.setTimeout(() => setAgendaToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [agendaToast]);

  const funcionariosFiltro = useMemo(() => {
    const map = new Map<string, string>();
    usuariosAtribuiveis.forEach((usuario) => map.set(usuario.id, usuario.nome));
    todosEventos.forEach((evento) => {
      const key = evento.responsavelId || evento.responsavelNome;
      if (key && evento.responsavelNome) map.set(key, evento.responsavelNome);
    });
    return Array.from(map, ([id, nome]) => ({ id, nome }));
  }, [todosEventos, usuariosAtribuiveis]);
  const empresasFiltro = useMemo(() => {
    const map = new Map<string, string>();
    empresas.forEach((empresa) => map.set(empresa.id, empresa.nome));
    todosEventos.forEach((evento) => {
      const key = evento.empresaId || evento.empresaNome;
      if (key && evento.empresaNome) map.set(key, evento.empresaNome);
    });
    return Array.from(map, ([id, nome]) => ({ id, nome }));
  }, [empresas, todosEventos]);

  const nomeTiposSelecionados = useMemo(() => {
    if (filtro.length === 0) {
      return 'Todos';
    }

    const nomes = filtro
      .map((id) => tiposDisponiveis.find((tipo) => tipo.id === id)?.label || id);

    if (nomes.length <= RESUMO_FILTRO_LIMIT) {
      return nomes.join(', ');
    }

    return `${nomes.slice(0, RESUMO_FILTRO_LIMIT).join(', ')} +${nomes.length - RESUMO_FILTRO_LIMIT}`;
  }, [filtro, tiposDisponiveis]);

  const nomeCategoriasSelecionadas = useMemo(() => {
    if (categoriaFiltro.length === 0) {
      return 'Todas';
    }

    const nomes = categoriaFiltro
      .map((id) => categoriasDisponiveis.find((categoria) => categoria.id === id)?.label || id);

    if (nomes.length <= RESUMO_FILTRO_LIMIT) {
      return nomes.join(', ');
    }

    return `${nomes.slice(0, RESUMO_FILTRO_LIMIT).join(', ')} +${nomes.length - RESUMO_FILTRO_LIMIT}`;
  }, [categoriaFiltro, categoriasDisponiveis]);

  const alternarTipoFiltro = (tipoId: string) => {
    setFiltro((atual) => (
      atual.includes(tipoId) ? atual.filter((id) => id !== tipoId) : [...atual, tipoId]
    ));
  };

  const alternarCategoriaFiltro = (categoriaId: string) => {
    setCategoriaFiltro((atual) => (
      atual.includes(categoriaId) ? atual.filter((id) => id !== categoriaId) : [...atual, categoriaId]
    ));
  };

  const limparFiltroTipo = () => setFiltro([]);

  const limparFiltroCategoria = () => setCategoriaFiltro([]);

  const limparTodosFiltros = () => {
    setFiltro([]);
    setCategoriaFiltro([]);
    setFuncionarioFiltro('todos');
    setEmpresaFiltro('todas');
  };

  const hasFiltrosAtivos = filtro.length > 0
    || categoriaFiltro.length > 0
    || funcionarioFiltro !== 'todos'
    || empresaFiltro !== 'todas';

  const eventosPorOrigem = useMemo(() => {
    const hojeIso = new Date().toISOString().split('T')[0];
    const futurosOrdenados = eventosFiltrados
      .filter((evento) => evento.data >= hojeIso)
      .sort((a, b) => a.data.localeCompare(b.data));

    const filtrarOrigem = (eventos: Evento[], origem: ReturnType<typeof getEventoOrigem>) => (
      eventos.filter((evento) => getEventoOrigem(evento) === origem)
    );

    return {
      manualDia: filtrarOrigem(eventosDoDia, 'manual'),
      manualProximos: filtrarOrigem(futurosOrdenados, 'manual').slice(0, 5),
      prazosDia: filtrarOrigem(eventosDoDia, 'prazo_fiscal'),
      prazosProximos: filtrarOrigem(futurosOrdenados, 'prazo_fiscal').slice(0, 5),
      atividadesDia: filtrarOrigem(eventosDoDia, 'atividade'),
      atividadesProximas: filtrarOrigem(futurosOrdenados, 'atividade').slice(0, 5),
    };
  }, [eventosDoDia, eventosFiltrados]);

  const abrirConfirmacaoExclusao = (evento: Evento) => {
    setEventoParaExcluir(evento);
  };

  const fecharConfirmacaoExclusao = () => {
    setEventoParaExcluir(null);
  };

  const confirmarExclusaoEvento = () => {
    if (!eventoParaExcluir) {
      return;
    }

    const tituloEvento = eventoParaExcluir.titulo;
    handleExcluirEvento(eventoParaExcluir.id, {
      onSuccess: () => {
        setAgendaToast({
          type: 'success',
          message: `Evento "${tituloEvento}" excluido com sucesso.`,
        });
      },
      onError: (error) => {
        const message = error instanceof Error
          ? error.message
          : 'Nao foi possivel excluir o evento agora.';
        setAgendaToast({
          type: 'error',
          message,
        });
      },
    });
    fecharConfirmacaoExclusao();
  };

  const formattedSelectedDate = diaSelecionado
    ? new Date(diaSelecionado + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
      })
    : '';

  const renderEventosLista = (eventos: Evento[], vazio: string) => (
    eventos.length === 0 ? (
      <div className="sem-eventos">{vazio}</div>
    ) : (
      <div className="agenda-eventos-lista">
        {eventos.map((evento) => (
          <EventoCard
            key={evento.id}
            evento={evento}
            onEdit={handleAbrirEdicao}
            onDeleteRequest={abrirConfirmacaoExclusao}
          />
        ))}
      </div>
    )
  );

  return (
    <div className="agenda-container animate-fade-in">
      {/* Top Toolbar */}
      <div className="agenda-toolbar">
        <div className="agenda-toolbar-left">
          <h1>Agenda e Pendências Operacionais</h1>
          <p>Eventos da rotina + prazos recorrentes.</p>
        </div>

        <div className="agenda-toolbar-right">
          <button className="btn-novo-evento" onClick={() => handleAbrirNovoEvento(diaSelecionado ?? undefined)}>
            <Plus size={16} /> Novo Evento
          </button>
        </div>
      </div>

      <div className="agenda-filter-active-row">
        {hasFiltrosAtivos ? (
          <>
            <div className="agenda-filter-chips">
              {filtro.map((tipoId) => {
                const item = tiposDisponiveis.find((tipo) => tipo.id === tipoId);
                return (
                  <button
                    type="button"
                    key={tipoId}
                    className="agenda-filter-chip"
                    onClick={() => setFiltro((atual) => atual.filter((id) => id !== tipoId))}
                    title="Remover filtro"
                  >
                    Tipo: {item?.label || tipoId}
                    <X size={12} />
                  </button>
                );
              })}

              {categoriaFiltro.map((categoriaId) => {
                const item = categoriasDisponiveis.find((categoria) => categoria.id === categoriaId);
                return (
                  <button
                    type="button"
                    key={categoriaId}
                    className="agenda-filter-chip"
                    onClick={() => setCategoriaFiltro((atual) => atual.filter((id) => id !== categoriaId))}
                    title="Remover filtro"
                  >
                    Categoria: {item?.label || categoriaId}
                    <X size={12} />
                  </button>
                );
              })}

              {funcionarioFiltro !== 'todos' && (
                <button
                  type="button"
                  className="agenda-filter-chip"
                  onClick={() => setFuncionarioFiltro('todos')}
                  title="Remover filtro"
                >
                  Funcionário: {funcionariosFiltro.find((item) => item.id === funcionarioFiltro)?.nome || 'Selecionado'}
                  <X size={12} />
                </button>
              )}

              {empresaFiltro !== 'todas' && (
                <button
                  type="button"
                  className="agenda-filter-chip"
                  onClick={() => setEmpresaFiltro('todas')}
                  title="Remover filtro"
                >
                  Empresa: {empresasFiltro.find((item) => item.id === empresaFiltro)?.nome || 'Sem empresa'}
                  <X size={12} />
                </button>
              )}
            </div>
            <button type="button" className="agenda-filter-clear-btn" onClick={limparTodosFiltros}>
              <X size={14} />
              Limpar filtros
            </button>
          </>
        ) : null}
      </div>

      <div className="agenda-filter-panel">
        <div className="agenda-filter-group">
          <div className="agenda-filter-header-row">
            <span className="agenda-filter-label">
              <Building2 size={14} />
              Empresa
            </span>
            <span className="agenda-filter-action-spacer" />
          </div>
          <select value={empresaFiltro} onChange={(event) => setEmpresaFiltro(event.target.value)}>
            <option value="todas">Todas</option>
            <option value="sem-empresa">Sem empresa</option>
            {empresasFiltro.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>
            ))}
          </select>
        </div>

        <div className="agenda-filter-group">
          <div className="agenda-filter-header-row">
            <span className="agenda-filter-label">
              <UserRound size={14} />
              Funcionário
            </span>
            <button
              type="button"
              className="agenda-filter-inline-btn"
              onClick={() => setModalCorResponsavelAberto(true)}
            >
              <Palette size={12} />
              Cores
            </button>
          </div>
          <select value={funcionarioFiltro} onChange={(event) => setFuncionarioFiltro(event.target.value)}>
            <option value="todos">Todos</option>
            {funcionariosFiltro.map((funcionario) => (
              <option key={funcionario.id} value={funcionario.id}>{funcionario.nome}</option>
            ))}
          </select>
        </div>

        <div className="agenda-filter-group">
          <div className="agenda-filter-header-row">
            <span className="agenda-filter-label">
              <CalendarRange size={14} />
              Tipo
            </span>
            <button
              type="button"
              className="agenda-filter-inline-btn"
              onClick={() => setModalGerenciarTipoAberto(true)}
            >
              <Settings2 size={12} />
              Gerenciar
            </button>
          </div>
          <div className="agenda-filter-list">
            <button
              type="button"
              className={`agenda-filter-list-toggle ${filtroTipoAberto ? 'open' : ''}`}
              onClick={() => setFiltroTipoAberto((aberto) => !aberto)}
            >
              <span>{nomeTiposSelecionados}</span>
              <ChevronDown size={14} />
            </button>
            {filtroTipoAberto && (
              <div className="agenda-filter-list-dropdown">
                <label className={`agenda-filter-list-item ${filtro.length === 0 ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={filtro.length === 0}
                    onChange={limparFiltroTipo}
                  />
                  <span className="filtro-dot" style={{ backgroundColor: '#64748b' }} />
                  <span>Todos</span>
                </label>
                {tiposDisponiveis.map((item) => {
                  const selecionado = filtro.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`agenda-filter-list-item ${selecionado ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => alternarTipoFiltro(item.id)}
                      />
                      <span className="filtro-dot" style={{ backgroundColor: item.cor }} />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="agenda-filter-group agenda-filter-group-categorias">
          <div className="agenda-filter-header-row">
            <span className="agenda-filter-label">
              <Tags size={14} />
              Categorias
            </span>
            <button
              type="button"
              className="agenda-filter-inline-btn"
              onClick={() => setModalGerenciarCategoriaAberto(true)}
            >
              <Settings2 size={12} />
              Gerenciar
            </button>
          </div>
          <div className="agenda-filter-list">
            <button
              type="button"
              className={`agenda-filter-list-toggle ${filtroCategoriaAberto ? 'open' : ''}`}
              onClick={() => setFiltroCategoriaAberto((aberto) => !aberto)}
            >
              <span>{nomeCategoriasSelecionadas}</span>
              <ChevronDown size={14} />
            </button>
            {filtroCategoriaAberto && (
              <div className="agenda-filter-list-dropdown">
                <label className={`agenda-filter-list-item ${categoriaFiltro.length === 0 ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={categoriaFiltro.length === 0}
                    onChange={limparFiltroCategoria}
                  />
                  <span className="filtro-dot" style={{ backgroundColor: '#64748b' }} />
                  <span>Todas</span>
                </label>
                {categoriasDisponiveis.map((item) => {
                  const selecionado = categoriaFiltro.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`agenda-filter-list-item ${selecionado ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selecionado}
                        onChange={() => alternarCategoriaFiltro(item.id)}
                      />
                      <span className="filtro-dot" style={{ backgroundColor: item.cor }} />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <AgendaTrimestreAtividades
        ano={anoAtual}
        mes={mesAtual}
        eventos={eventosTrimestreFiltrados}
        diaSelecionado={diaSelecionado}
        onSelectDia={setDiaSelecionado}
        onNavegarMes={navegarMes}
        categoriasEvento={categoriasEvento}
        usuariosCores={usuariosAgenda}
        mesesVisiveis={3}
      />

      {/* Corpo da agenda */}
      <div className="agenda-body agenda-body-eventos">
        <div className="agenda-painel agenda-origem-grid">
          <div className="agenda-painel-section agenda-origem-section">
            <div className="agenda-section-title">
              <h3>
                <CalendarDays size={14} />
                Agenda
              </h3>
              <span>Eventos manuais</span>
            </div>
            <div className="agenda-subsection">
              <strong>{formattedSelectedDate || 'Dia selecionado'}</strong>
              {renderEventosLista(eventosPorOrigem.manualDia, 'Nenhum evento manual neste dia.')}
            </div>
            <div className="agenda-subsection">
              <strong>Próximos eventos</strong>
              {renderEventosLista(eventosPorOrigem.manualProximos, 'Nenhum evento manual futuro.')}
            </div>
          </div>

          <div className="agenda-painel-section agenda-origem-section">
            <div className="agenda-section-title">
              <h3>
                <ShieldAlert size={14} />
                Prazos Recorrentes
              </h3>
              <span>Obrigação fiscal</span>
            </div>
            <div className="agenda-subsection">
              <strong>{formattedSelectedDate || 'Dia selecionado'}</strong>
              {renderEventosLista(eventosPorOrigem.prazosDia, 'Nenhum prazo fiscal neste dia.')}
            </div>
            <div className="agenda-subsection">
              <strong>Próximos prazos</strong>
              {renderEventosLista(eventosPorOrigem.prazosProximos, 'Nenhum prazo fiscal futuro.')}
            </div>
            <PrazosAutomaticos compacto />
          </div>

          <div className="agenda-painel-section agenda-origem-section">
            <div className="agenda-section-title">
              <h3>
                <CalendarRange size={14} />
                Tarefas de Atividades
              </h3>
              <span>Integração operacional</span>
            </div>
            <div className="agenda-subsection">
              <strong>{formattedSelectedDate || 'Dia selecionado'}</strong>
              {renderEventosLista(eventosPorOrigem.atividadesDia, 'Nenhuma tarefa de atividade neste dia.')}
            </div>
            <div className="agenda-subsection">
              <strong>Próximas tarefas</strong>
              {renderEventosLista(eventosPorOrigem.atividadesProximas, 'Nenhuma tarefa de atividade futura.')}
            </div>

            {vencimentos.length > 0 && (
              <div className="agenda-subsection">
                <strong>Docs & certificados</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {vencimentos.map(v => (
                  <div key={v.id} style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: v.diasRestantes < 0 ? '#fef2f2' : '#fff7ed',
                    border: `1px solid ${v.diasRestantes < 0 ? '#fecaca' : '#fed7aa'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                        {v.tipo === 'certificado' ? '🔐' : '📄'} {v.nome}
                      </span>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 800,
                        color: v.diasRestantes < 0 ? '#ef4444' : '#f97316'
                      }}>
                        {v.diasRestantes < 0 ? 'Vencido' : `Em ${v.diasRestantes}d`}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      {v.empresaNome} • Val. {v.dataValidade}
                    </span>
                  </div>
                ))}
              </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Criação / Edição */}
      <EventoModal
        aberto={modalAberto}
        onClose={() => setModalAberto(false)}
        onSalvar={handleSalvarEvento}
        evento={eventoEditando}
        empresas={empresas}
        usuarioAtual={usuarioAtual}
        usuariosAtribuiveis={usuariosAtribuiveis}
        dataInicial={diaSelecionado}
        tiposEvento={tiposEvento}
        categoriasEvento={categoriasEvento}
      />

      <AgendaConfigListModal
        aberto={modalGerenciarTipoAberto}
        titulo="Gerenciar Tipos"
        itens={tiposEvento}
        onSalvar={handleSalvarTiposEventoConfig}
        onClose={() => setModalGerenciarTipoAberto(false)}
      />

      <AgendaConfigListModal
        aberto={modalGerenciarCategoriaAberto}
        titulo="Gerenciar Categorias"
        itens={categoriasEvento}
        onSalvar={handleSalvarCategoriasEventoConfig}
        onClose={() => setModalGerenciarCategoriaAberto(false)}
      />

      <AgendaResponsavelCorModal
        aberto={modalCorResponsavelAberto}
        onSalvar={handleSalvarResponsaveisAgendaConfig}
        onClose={() => setModalCorResponsavelAberto(false)}
        usuarios={usuariosAgenda}
      />

      <AgendaDeleteEventModal
        isOpen={!!eventoParaExcluir}
        evento={eventoParaExcluir}
        onClose={fecharConfirmacaoExclusao}
        onConfirm={confirmarExclusaoEvento}
      />

      {agendaToast && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            top: '18px',
            right: '18px',
            zIndex: 10000,
            width: 'min(380px, calc(100vw - 32px))',
            padding: '12px 14px',
            borderRadius: '10px',
            background: '#0f172a',
            border: `1px solid ${agendaToast.type === 'success' ? 'rgba(197, 146, 53, 0.5)' : 'rgba(239, 68, 68, 0.55)'}`,
            color: '#ffffff',
            boxShadow: '0 18px 46px rgba(15, 23, 42, 0.28)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.82rem',
            fontWeight: 750,
          }}
          role="status"
          aria-live="polite"
        >
          {agendaToast.type === 'success' ? (
            <CheckCircle2 size={18} style={{ color: '#d9a441', flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          )}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {agendaToast.message}
          </span>
        </div>
      )}
    </div>
  );
};
