import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useInternalTabs } from '../../../hooks/useInternalTabs';
import { inicioService } from '../inicio/services/inicioService';
import type { NavigationContext } from '../shared/operationalTypes';
import { AgendaConfigListModal } from './components/AgendaConfigListModal';
import { AgendaDeleteEventModal } from './components/AgendaDeleteEventModal';
import { AgendaEquipeTable } from './components/AgendaEquipeTable';
import { AgendaEventosBoard } from './components/AgendaEventosBoard';
import { AgendaFiltersPanel } from './components/AgendaFiltersPanel';
import { AgendaModuleTabs, type AgendaAba } from './components/AgendaModuleTabs';
import { AgendaPadroesGestor } from './components/AgendaPadroesGestor';
import { AgendaResponsavelCorModal } from './components/AgendaResponsavelCorModal';
import { AgendaToast, type AgendaToastData } from './components/AgendaToast';
import { AgendaTrimestreAtividades } from './components/AgendaTrimestreAtividades';
import { EventoModal } from './components/EventoModal';
import { useAgenda } from './hooks/useAgenda';
import { useAgendaRealtime } from './hooks/useAgendaRealtime';
import { getEventoOrigem, type Evento } from './services/agenda.service';
import './Agenda.css';
import './styles/AgendaPart05.css';

const RESUMO_FILTRO_LIMIT = 2;

export const AgendaPage: React.FC = () => {
  useAgendaRealtime(true);
  const { openTab } = useInternalTabs();
  const agenda = useAgenda();
  const vencimentos = useMemo(() => inicioService.getVencimentosProximos(), []);

  const [abaAgenda, setAbaAgenda] = useState<AgendaAba>('calendario');
  const [filtroTipoAberto, setFiltroTipoAberto] = useState(false);
  const [filtroCategoriaAberto, setFiltroCategoriaAberto] = useState(false);
  const [modalGerenciarTipoAberto, setModalGerenciarTipoAberto] = useState(false);
  const [modalGerenciarCategoriaAberto, setModalGerenciarCategoriaAberto] = useState(false);
  const [modalCorResponsavelAberto, setModalCorResponsavelAberto] = useState(false);
  const [eventoParaExcluir, setEventoParaExcluir] = useState<Evento | null>(null);
  const [agendaToast, setAgendaToast] = useState<AgendaToastData | null>(null);

  const tiposDisponiveis = useMemo(() => agenda.tiposEvento.filter((item) => item.ativo), [agenda.tiposEvento]);
  const categoriasDisponiveis = useMemo(
    () => agenda.categoriasEvento.filter((item) => item.ativo),
    [agenda.categoriasEvento],
  );

  useEffect(() => {
    if (!agendaToast) return;
    const timer = window.setTimeout(() => setAgendaToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [agendaToast]);

  useEffect(() => {
    if ((abaAgenda === 'padroes' || abaAgenda === 'equipe') && !agenda.podeGerenciarPadroes) {
      setAbaAgenda('calendario');
    }
  }, [abaAgenda, agenda.podeGerenciarPadroes]);

  const funcionariosFiltro = useMemo(() => {
    const map = new Map<string, string>();
    agenda.usuariosAtribuiveis.forEach((usuario) => map.set(usuario.id, usuario.nome));
    agenda.todosEventos.forEach((evento) => {
      const key = evento.responsavelId || evento.responsavelNome;
      if (key && evento.responsavelNome) map.set(key, evento.responsavelNome);
    });
    return Array.from(map, ([id, nome]) => ({ id, nome }));
  }, [agenda.todosEventos, agenda.usuariosAtribuiveis]);

  const empresasFiltro = useMemo(() => {
    const map = new Map<string, string>();
    agenda.empresas.forEach((empresa) => map.set(empresa.id, empresa.nome));
    agenda.todosEventos.forEach((evento) => {
      const key = evento.empresaId || evento.empresaNome;
      if (key && evento.empresaNome) map.set(key, evento.empresaNome);
    });
    return Array.from(map, ([id, nome]) => ({ id, nome }));
  }, [agenda.empresas, agenda.todosEventos]);

  const nomeTiposSelecionados = useMemo(
    () => getResumoFiltro(agenda.filtro, tiposDisponiveis.map(({ id, label }) => ({ id, label })), 'Todos'),
    [agenda.filtro, tiposDisponiveis],
  );

  const nomeCategoriasSelecionadas = useMemo(
    () => getResumoFiltro(agenda.categoriaFiltro, categoriasDisponiveis.map(({ id, label }) => ({ id, label })), 'Todas'),
    [agenda.categoriaFiltro, categoriasDisponiveis],
  );

  const eventosPorOrigem = useMemo(() => {
    const hojeIso = new Date().toISOString().split('T')[0];
    const futurosOrdenados = agenda.eventosFiltrados
      .filter((evento) => evento.data >= hojeIso)
      .sort((a, b) => a.data.localeCompare(b.data));
    const filtrarOrigem = (eventos: Evento[], origem: ReturnType<typeof getEventoOrigem>) => (
      eventos.filter((evento) => getEventoOrigem(evento) === origem)
    );

    return {
      manualDia: filtrarOrigem(agenda.eventosDoDia, 'manual'),
      manualProximos: filtrarOrigem(futurosOrdenados, 'manual').slice(0, 5),
      calendarioDia: filtrarOrigem(agenda.eventosDoDia, 'calendario'),
      calendarioProximos: filtrarOrigem(futurosOrdenados, 'calendario').slice(0, 5),
      prazosDia: filtrarOrigem(agenda.eventosDoDia, 'prazo_fiscal'),
      prazosProximos: filtrarOrigem(futurosOrdenados, 'prazo_fiscal').slice(0, 5),
      atividadesDia: filtrarOrigem(agenda.eventosDoDia, 'atividade'),
      atividadesProximas: filtrarOrigem(futurosOrdenados, 'atividade').slice(0, 5),
    };
  }, [agenda.eventosDoDia, agenda.eventosFiltrados]);

  const prazosFixosMes = useMemo(() => {
    const mesKey = `${agenda.anoAtual}-${String(agenda.mesAtual + 1).padStart(2, '0')}`;
    return agenda.eventosFiltrados
      .filter((evento) => getEventoOrigem(evento) === 'prazo_fiscal' && evento.data.startsWith(mesKey))
      .sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  }, [agenda.anoAtual, agenda.eventosFiltrados, agenda.mesAtual]);

  const formattedSelectedDate = agenda.diaSelecionado
    ? new Date(`${agenda.diaSelecionado}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
    : '';

  const alternarTipoFiltro = (tipoId: string) => agenda.setFiltro((atual) => (
    atual.includes(tipoId) ? atual.filter((id) => id !== tipoId) : [...atual, tipoId]
  ));

  const alternarCategoriaFiltro = (categoriaId: string) => agenda.setCategoriaFiltro((atual) => (
    atual.includes(categoriaId) ? atual.filter((id) => id !== categoriaId) : [...atual, categoriaId]
  ));

  const limparTodosFiltros = () => {
    agenda.setFiltro([]);
    agenda.setCategoriaFiltro([]);
    agenda.setFuncionarioFiltro('todos');
    agenda.setEmpresaFiltro('todas');
  };

  const confirmarExclusaoEvento = () => {
    if (!eventoParaExcluir) return;
    const tituloEvento = eventoParaExcluir.titulo;
    agenda.handleExcluirEvento(eventoParaExcluir.id, {
      onSuccess: () => setAgendaToast({ type: 'success', message: `Evento "${tituloEvento}" excluido com sucesso.` }),
      onError: (error) => setAgendaToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Nao foi possivel excluir o evento agora.',
      }),
    });
    setEventoParaExcluir(null);
  };

  const abrirOrigemEvento = (evento: Evento) => {
    const origem = getEventoOrigem(evento);
    if (origem === 'manual') {
      agenda.handleAbrirEdicao(evento);
      return;
    }
    if (origem === 'atividade') abrirAtividade(openTab, evento);
    if (origem === 'prazo_fiscal') abrirConformidade(openTab, evento);
  };

  return (
    <div className="agenda-container animate-fade-in">
      <div className="agenda-toolbar">
        <div className="agenda-toolbar-left">
          <h1>Agenda e Pendências Operacionais</h1>
          <p>Eventos da rotina + prazos recorrentes.</p>
        </div>
        <div className="agenda-toolbar-right">
          <button className="btn-novo-evento" onClick={() => agenda.handleAbrirNovoEvento(agenda.diaSelecionado ?? undefined)}>
            <Plus size={16} /> Novo Evento
          </button>
        </div>
      </div>

      <AgendaModuleTabs abaAtual={abaAgenda} podeGerenciarPadroes={agenda.podeGerenciarPadroes} onChange={setAbaAgenda} />

      {abaAgenda !== 'padroes' ? (
        <>
          <AgendaFiltersPanel
            filtro={agenda.filtro}
            categoriaFiltro={agenda.categoriaFiltro}
            funcionarioFiltro={agenda.funcionarioFiltro}
            empresaFiltro={agenda.empresaFiltro}
            tiposDisponiveis={tiposDisponiveis}
            categoriasDisponiveis={categoriasDisponiveis}
            funcionariosFiltro={funcionariosFiltro}
            empresasFiltro={empresasFiltro}
            nomeTiposSelecionados={nomeTiposSelecionados}
            nomeCategoriasSelecionadas={nomeCategoriasSelecionadas}
            filtroTipoAberto={filtroTipoAberto}
            filtroCategoriaAberto={filtroCategoriaAberto}
            onSetFiltro={agenda.setFiltro}
            onSetCategoriaFiltro={agenda.setCategoriaFiltro}
            onSetFuncionarioFiltro={agenda.setFuncionarioFiltro}
            onSetEmpresaFiltro={agenda.setEmpresaFiltro}
            onSetFiltroTipoAberto={setFiltroTipoAberto}
            onSetFiltroCategoriaAberto={setFiltroCategoriaAberto}
            onLimparTodosFiltros={limparTodosFiltros}
            onLimparFiltroTipo={() => agenda.setFiltro([])}
            onLimparFiltroCategoria={() => agenda.setCategoriaFiltro([])}
            onAlternarTipoFiltro={alternarTipoFiltro}
            onAlternarCategoriaFiltro={alternarCategoriaFiltro}
            onGerenciarTipos={() => setModalGerenciarTipoAberto(true)}
            onGerenciarCategorias={() => setModalGerenciarCategoriaAberto(true)}
            onGerenciarCores={() => setModalCorResponsavelAberto(true)}
            podeGerenciar={agenda.podeGerenciarPadroes}
          />
          {abaAgenda === 'equipe' ? (
            <AgendaEquipeTable
              eventos={agenda.eventosFiltrados}
              usuarios={agenda.usuariosAgenda}
              categoriasEvento={agenda.categoriasEvento}
              onEdit={abrirOrigemEvento}
              onDeleteRequest={setEventoParaExcluir}
              onToggleComplete={agenda.handleToggleConcluido}
            />
          ) : (
            <>
              <AgendaTrimestreAtividades
                ano={agenda.anoAtual}
                mes={agenda.mesAtual}
                eventos={agenda.eventosTrimestreFiltrados}
                diaSelecionado={agenda.diaSelecionado}
                onSelectDia={agenda.setDiaSelecionado}
                onNavegarMes={agenda.navegarMes}
                categoriasEvento={agenda.categoriasEvento}
                usuariosCores={agenda.usuariosAgenda}
                mesesVisiveis={3}
                prazosFixosMes={prazosFixosMes}
              />
              <AgendaEventosBoard
                eventosPorOrigem={eventosPorOrigem}
                vencimentos={vencimentos}
                formattedSelectedDate={formattedSelectedDate}
                onEdit={abrirOrigemEvento}
                onDeleteRequest={setEventoParaExcluir}
                onToggleComplete={agenda.handleToggleConcluido}
              />
            </>
          )}
        </>
      ) : (
        <AgendaPadroesGestor
          padroes={agenda.agendaPadroes}
          podeGerenciar={agenda.podeGerenciarPadroes}
          onSalvar={agenda.handleSalvarPadroesAgenda}
          onToast={(type, message) => setAgendaToast({ type, message })}
        />
      )}

      <AgendaModals
        agenda={agenda}
        modalGerenciarTipoAberto={modalGerenciarTipoAberto}
        modalGerenciarCategoriaAberto={modalGerenciarCategoriaAberto}
        modalCorResponsavelAberto={modalCorResponsavelAberto}
        eventoParaExcluir={eventoParaExcluir}
        onCloseTipo={() => setModalGerenciarTipoAberto(false)}
        onCloseCategoria={() => setModalGerenciarCategoriaAberto(false)}
        onCloseCores={() => setModalCorResponsavelAberto(false)}
        onCloseExcluir={() => setEventoParaExcluir(null)}
        onConfirmExcluir={confirmarExclusaoEvento}
      />
      <AgendaToast toast={agendaToast} />
    </div>
  );
};

type UseAgendaReturn = ReturnType<typeof useAgenda>;

const AgendaModals: React.FC<{
  agenda: UseAgendaReturn;
  modalGerenciarTipoAberto: boolean;
  modalGerenciarCategoriaAberto: boolean;
  modalCorResponsavelAberto: boolean;
  eventoParaExcluir: Evento | null;
  onCloseTipo: () => void;
  onCloseCategoria: () => void;
  onCloseCores: () => void;
  onCloseExcluir: () => void;
  onConfirmExcluir: () => void;
}> = ({
  agenda,
  modalGerenciarTipoAberto,
  modalGerenciarCategoriaAberto,
  modalCorResponsavelAberto,
  eventoParaExcluir,
  onCloseTipo,
  onCloseCategoria,
  onCloseCores,
  onCloseExcluir,
  onConfirmExcluir,
}) => (
  <>
    <EventoModal
      aberto={agenda.modalAberto}
      onClose={() => agenda.setModalAberto(false)}
      onSalvar={agenda.handleSalvarEvento}
      evento={agenda.eventoEditando}
      empresas={agenda.empresas}
      usuarioAtual={agenda.usuarioAtual}
      usuariosAtribuiveis={agenda.usuariosAtribuiveis}
      dataInicial={agenda.diaSelecionado}
      tiposEvento={agenda.tiposEvento}
      categoriasEvento={agenda.categoriasEvento}
    />
    <AgendaConfigListModal aberto={modalGerenciarTipoAberto} titulo="Gerenciar Tipos" itens={agenda.tiposEvento} onSalvar={agenda.handleSalvarTiposEventoConfig} onClose={onCloseTipo} />
    <AgendaConfigListModal aberto={modalGerenciarCategoriaAberto} titulo="Gerenciar Categorias" itens={agenda.categoriasEvento} onSalvar={agenda.handleSalvarCategoriasEventoConfig} onClose={onCloseCategoria} />
    <AgendaResponsavelCorModal aberto={modalCorResponsavelAberto} onSalvar={agenda.handleSalvarResponsaveisAgendaConfig} onClose={onCloseCores} usuarios={agenda.usuariosAgenda} />
    <AgendaDeleteEventModal isOpen={!!eventoParaExcluir} evento={eventoParaExcluir} onClose={onCloseExcluir} onConfirm={onConfirmExcluir} />
  </>
);

const getResumoFiltro = (
  ids: string[],
  itens: Array<{ id: string; label: string }>,
  emptyLabel: string,
) => {
  if (ids.length === 0) return emptyLabel;
  const nomes = ids.map((id) => itens.find((item) => item.id === id)?.label || id);
  if (nomes.length <= RESUMO_FILTRO_LIMIT) return nomes.join(', ');
  return `${nomes.slice(0, RESUMO_FILTRO_LIMIT).join(', ')} +${nomes.length - RESUMO_FILTRO_LIMIT}`;
};

const abrirAtividade = (openTab: ReturnType<typeof useInternalTabs>['openTab'], evento: Evento) => {
  const navigationContext: NavigationContext = {
    sourceModule: 'agenda',
    sourceId: evento.id,
    atividadeId: evento.id.replace('atividade:', ''),
    companyId: evento.empresaId,
    returnTo: 'agenda',
  };

  openTab('atividades', 'Minha Fila', 'ClipboardList', {
    titleSuffix: 'Minha Fila',
    data: { ...navigationContext, activeView: 'minha-fila', queueFilter: 'semana' },
  });
};

const abrirConformidade = (openTab: ReturnType<typeof useInternalTabs>['openTab'], evento: Evento) => {
  const navigationContext: NavigationContext = {
    sourceModule: 'agenda',
    sourceId: evento.id,
    companyId: evento.empresaId,
    returnTo: 'agenda',
  };

  openTab('conformidade', 'Conformidade', 'ShieldCheck', {
    titleSuffix: 'Riscos e SLA',
    data: { ...navigationContext, selectedCompanyId: evento.empresaId },
  });
};
