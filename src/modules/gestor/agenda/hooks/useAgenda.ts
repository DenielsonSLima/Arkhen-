import { useState, useMemo, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getEventosPorIntervalo,
  getCategoriasEventoConfig,
  getTiposEventoConfig,
  getResponsaveisAgendaConfig,
  adicionarEvento,
  editarEvento,
  removerEvento,
  salvarCategoriasEventoConfig,
  salvarTiposEventoConfig,
  salvarResponsaveisAgendaConfig,
  getAgendaPodeGerenciarPadroes,
  getAgendaPadroesEventos,
  salvarAgendaPadroesEventos,
  getCategoriaPadraoPorTipo,
  type Evento,
  type AgendaPadraoEvento,
  type TipoEventoConfig,
  type CategoriaEventoConfig,
} from '../services/agenda.service';
import type { UsuarioAgenda } from '../services/agenda.defaults';

export type FiltroEvento = string[];

const HIERARQUIA_PERFIL: Record<UsuarioAgenda['perfil'], number> = {
  Administrador: 5,
  Gestor: 4,
  'Contador Pleno': 3,
  Assistente: 2,
  Estagiário: 1,
};

const usuarioFallback: UsuarioAgenda = {
  id: '',
  nome: '',
  perfil: 'Administrador',
  status: 'Ativo',
  cor: '#64748b',
  ativo: true,
};

export const agendaKeys = {
  all: ['agenda'] as const,
  eventos: (ano: number, mes: number, meses: number) => [...agendaKeys.all, 'eventos', ano, mes, meses] as const,
  tipos: () => [...agendaKeys.all, 'tipos'] as const,
  categorias: () => [...agendaKeys.all, 'categorias'] as const,
  responsaveis: () => [...agendaKeys.all, 'responsaveis'] as const,
  permissoes: () => [...agendaKeys.all, 'permissoes'] as const,
  padroes: () => [...agendaKeys.all, 'padroes'] as const,
};

export function useAgenda() {
  const queryClient = useQueryClient();
  const status = 'Em desenvolvimento';
  const hoje = new Date();
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear());
  const [mesAtual, setMesAtual] = useState(hoje.getMonth());
  const [filtro, setFiltro] = useState<FiltroEvento>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string[]>([]);
  const [funcionarioFiltro, setFuncionarioFiltro] = useState('todos');
  const [empresaFiltro, setEmpresaFiltro] = useState('todas');
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(
    hoje.toISOString().split('T')[0],
  );
  const [modalAberto, setModalAberto] = useState(false);
  const [eventoEditando, setEventoEditando] = useState<Evento | null>(null);

  const mesesVisiveis = 1;
  const mesesTrimestre = 3;
  const deslocamentoInicialTrimestre = Math.floor((mesesTrimestre - 1) / 2);

  const tiposQuery = useQuery({
    queryKey: agendaKeys.tipos(),
    queryFn: getTiposEventoConfig,
    staleTime: 30_000,
  });

  const categoriasQuery = useQuery({
    queryKey: agendaKeys.categorias(),
    queryFn: getCategoriasEventoConfig,
    staleTime: 30_000,
  });

  const responsaveisQuery = useQuery({
    queryKey: agendaKeys.responsaveis(),
    queryFn: getResponsaveisAgendaConfig,
    staleTime: 30_000,
  });

  const permissoesQuery = useQuery({
    queryKey: agendaKeys.permissoes(),
    queryFn: getAgendaPodeGerenciarPadroes,
    staleTime: 60_000,
  });

  const padroesQuery = useQuery({
    queryKey: agendaKeys.padroes(),
    queryFn: getAgendaPadroesEventos,
    staleTime: 30_000,
  });

  const eventosQuery = useQuery({
    queryKey: agendaKeys.eventos(anoAtual, mesAtual, mesesVisiveis),
    queryFn: () => getEventosPorIntervalo(anoAtual, mesAtual, mesesVisiveis),
    staleTime: 15_000,
  });

  const eventosTrimestreQuery = useQuery({
    queryKey: agendaKeys.eventos(anoAtual, mesAtual - deslocamentoInicialTrimestre, mesesTrimestre),
    queryFn: () => getEventosPorIntervalo(anoAtual, mesAtual - deslocamentoInicialTrimestre, mesesTrimestre),
    staleTime: 15_000,
  });

  const invalidateAgenda = () => {
    queryClient.invalidateQueries({ queryKey: agendaKeys.all });
  };

  const salvarEventoMutation = useMutation({
    mutationFn: async (dados: Omit<Evento, 'id'> & { id?: string }) => {
      if (dados.id) return editarEvento(dados.id, dados);
      return adicionarEvento(dados);
    },
    onSuccess: invalidateAgenda,
  });

  const excluirEventoMutation = useMutation({
    mutationFn: (id: string) => removerEvento(id),
    onSuccess: invalidateAgenda,
  });

  const salvarTiposMutation = useMutation({
    mutationFn: (proximos: TipoEventoConfig[]) => salvarTiposEventoConfig(proximos),
    onSuccess: (normalizados) => {
      queryClient.setQueryData(agendaKeys.tipos(), normalizados);
      invalidateAgenda();
    },
  });

  const salvarCategoriasMutation = useMutation({
    mutationFn: (proximos: CategoriaEventoConfig[]) => salvarCategoriasEventoConfig(proximos),
    onSuccess: (normalizados) => {
      queryClient.setQueryData(agendaKeys.categorias(), normalizados);
      invalidateAgenda();
    },
  });

  const salvarResponsaveisMutation = useMutation({
    mutationFn: (proximos: UsuarioAgenda[]) => salvarResponsaveisAgendaConfig(proximos),
    onSuccess: (normalizados) => {
      queryClient.setQueryData(agendaKeys.responsaveis(), normalizados);
      invalidateAgenda();
    },
  });

  const salvarPadroesMutation = useMutation({
    mutationFn: (proximos: AgendaPadraoEvento[]) => salvarAgendaPadroesEventos(proximos),
    onSuccess: (normalizados) => {
      queryClient.setQueryData(agendaKeys.padroes(), normalizados);
      invalidateAgenda();
    },
  });

  const usuariosAgenda = responsaveisQuery.data || [];
  const tiposEvento = tiposQuery.data || [];
  const categoriasEvento = categoriasQuery.data || [];
  const agendaPadroes = padroesQuery.data || [];
  const podeGerenciarPadroes = Boolean(permissoesQuery.data);
  const todosEventos = eventosQuery.data || [];
  const eventosTrimestre = eventosTrimestreQuery.data || [];
  const usuarioAtual = usuariosAgenda[0] || usuarioFallback;

  const usuariosAtribuiveis = useMemo(() => {
    const hierarquiaAtual = HIERARQUIA_PERFIL[usuarioAtual.perfil] || 5;
    return usuariosAgenda.filter((usuario) => (
      usuario.status === 'Ativo' &&
      usuario.ativo &&
      (usuario.id === usuarioAtual.id || (HIERARQUIA_PERFIL[usuario.perfil] || 0) < hierarquiaAtual)
    ));
  }, [usuarioAtual.id, usuarioAtual.perfil, usuariosAgenda]);

  const aplicarFiltros = useCallback((eventos: Evento[]) => {
    return eventos.filter((evento) => {
      const categoriaId = evento.categoriaId || getCategoriaPadraoPorTipo(evento.tipo);
      const responsavelKey = evento.responsavelId || evento.responsavelNome || 'sem-responsavel';
      const empresaKey = evento.empresaId || evento.empresaNome || 'sem-empresa';

      if (filtro.length > 0 && !filtro.includes(evento.tipo)) return false;
      if (categoriaFiltro.length > 0 && !categoriaFiltro.includes(categoriaId)) return false;
      if (funcionarioFiltro !== 'todos' && responsavelKey !== funcionarioFiltro) return false;
      if (empresaFiltro !== 'todas' && empresaKey !== empresaFiltro) return false;

      return true;
    });
  }, [categoriaFiltro, empresaFiltro, filtro, funcionarioFiltro]);

  const eventosFiltrados = useMemo(() => aplicarFiltros(todosEventos), [aplicarFiltros, todosEventos]);
  const eventosTrimestreFiltrados = useMemo(() => aplicarFiltros(eventosTrimestre), [aplicarFiltros, eventosTrimestre]);

  const eventosDoDia = useMemo(() => {
    if (!diaSelecionado) return [];
    return eventosFiltrados.filter((e) => e.data === diaSelecionado);
  }, [eventosFiltrados, diaSelecionado]);

  const proximosEventos = useMemo(() => {
    const hojeKey = new Date().toISOString().split('T')[0];
    return eventosFiltrados
      .filter((e) => e.data >= hojeKey)
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 8);
  }, [eventosFiltrados]);

  const empresas = useMemo(() => {
    const map = new Map<string, { id: string; nome: string }>();
    eventosFiltrados.forEach((evento) => {
      const id = evento.empresaId || evento.empresaNome;
      if (id && evento.empresaNome) map.set(id, { id, nome: evento.empresaNome });
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [eventosFiltrados]);

  const navegarMes = useCallback((direcao: 1 | -1) => {
    setDiaSelecionado(null);
    setMesAtual((prev) => {
      const novo = prev + direcao;
      if (novo > 11) { setAnoAtual((a) => a + 1); return 0; }
      if (novo < 0) { setAnoAtual((a) => a - 1); return 11; }
      return novo;
    });
  }, []);

  const handleSalvarEvento = useCallback((dados: Omit<Evento, 'id'> & { id?: string }) => {
    const responsavel = usuariosAtribuiveis.find((usuario) => usuario.id === dados.responsavelId) || usuarioAtual;
    const eventoNormalizado = {
      ...dados,
      responsavelId: responsavel.id || undefined,
      responsavelNome: responsavel.nome || undefined,
      responsavelPerfil: responsavel.perfil,
      criadoPorId: dados.criadoPorId || usuarioAtual.id || undefined,
      criadoPorNome: dados.criadoPorNome || usuarioAtual.nome || undefined,
    };

    salvarEventoMutation.mutate(eventoNormalizado, {
      onSuccess: () => {
        setModalAberto(false);
        setEventoEditando(null);
      },
    });
  }, [salvarEventoMutation, usuarioAtual, usuariosAtribuiveis]);

  const handleExcluirEvento = useCallback((
    id: string,
    options?: {
      onSuccess?: () => void;
      onError?: (error: unknown) => void;
    },
  ) => {
    excluirEventoMutation.mutate(id, options);
  }, [excluirEventoMutation]);

  const handleAbrirNovoEvento = useCallback((data?: string) => {
    setEventoEditando(null);
    if (data) setDiaSelecionado(data);
    setModalAberto(true);
  }, []);

  const handleAbrirEdicao = useCallback((evento: Evento) => {
    setEventoEditando(evento);
    setModalAberto(true);
  }, []);

  const handleSalvarTiposEventoConfig = useCallback((proximos: TipoEventoConfig[]) => {
    salvarTiposMutation.mutate(proximos, {
      onSuccess: (normalizados) => {
        const ativos = new Set(normalizados.filter((tipo) => tipo.ativo).map((tipo) => tipo.id));
        setFiltro((valorAtual) => valorAtual.filter((id) => ativos.has(id)));
      },
    });
  }, [salvarTiposMutation]);

  const handleSalvarCategoriasEventoConfig = useCallback((proximos: CategoriaEventoConfig[]) => {
    salvarCategoriasMutation.mutate(proximos, {
      onSuccess: (normalizados) => {
        const ativos = new Set(normalizados.filter((categoria) => categoria.ativo).map((categoria) => categoria.id));
        setCategoriaFiltro((valorAtual) => valorAtual.filter((id) => ativos.has(id)));
      },
    });
  }, [salvarCategoriasMutation]);

  const handleSalvarResponsaveisAgendaConfig = useCallback((proximos: UsuarioAgenda[]) => {
    salvarResponsaveisMutation.mutate(proximos);
  }, [salvarResponsaveisMutation]);

  const handleSalvarPadroesAgenda = useCallback((
    proximos: AgendaPadraoEvento[],
    options?: { onSuccess?: () => void; onError?: (error: unknown) => void },
  ) => {
    salvarPadroesMutation.mutate(proximos, options);
  }, [salvarPadroesMutation]);

  return {
    status,
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
    tiposEvento,
    categoriasEvento,
    usuariosAgenda,
    agendaPadroes,
    podeGerenciarPadroes,
    diaSelecionado,
    setDiaSelecionado,
    todosEventos,
    eventosFiltrados,
    eventosTrimestreFiltrados,
    eventosDoDia,
    proximosEventos,
    navegarMes,
    modalAberto,
    setModalAberto,
    eventoEditando,
    handleSalvarEvento,
    handleExcluirEvento,
    handleAbrirNovoEvento,
    handleAbrirEdicao,
    empresas,
    usuarioAtual,
    usuariosAtribuiveis,
    handleSalvarTiposEventoConfig,
    handleSalvarCategoriasEventoConfig,
    handleSalvarResponsaveisAgendaConfig,
    handleSalvarPadroesAgenda,
    isLoading: eventosQuery.isLoading || eventosTrimestreQuery.isLoading,
  };
}
