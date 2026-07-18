import React, { useMemo, useState } from 'react';
import { useAtividadesWorkspace } from '../hooks/useAtividadesWorkspace';
import {
  todayKey,
  type TarefaGestor,
} from '../services/rotinasAtividadesService';
import { ModalNovaTarefa } from './ModalNovaTarefa';
import { ModalVincularRotina } from './ModalVincularRotina';
import { CompanyInspector } from './gerir-equipe/CompanyInspector';
import { PeriodToolbar } from './gerir-equipe/PeriodToolbar';
import { TaskInspector } from './gerir-equipe/TaskInspector';
import { TaskSummaryCards } from './gerir-equipe/TaskSummaryCards';
import { UserCardsGrid } from './gerir-equipe/UserCardsGrid';
import { UserHeader } from './gerir-equipe/UserHeader';
import type { AbaGerirEquipeProps, PeriodoFiltro, UsuarioEquipe } from './gerir-equipe/types';
import {
  getTaskSummary,
  getUserStats,
  isTaskInPeriod,
  shiftPeriodDate,
} from './gerir-equipe/utils';

export const AbaGerirEquipe: React.FC<AbaGerirEquipeProps> = ({
  companyGroups = [],
  handleToggleStep,
}) => {
  const { rotinas, tarefas, usuarios, saveRotina, saveTarefaAsync, deleteTarefa, updateTarefa, toggleChecklist } = useAtividadesWorkspace();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('semana');
  const [dataBase, setDataBase] = useState(todayKey());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [modalVincularAberto, setModalVincularAberto] = useState(false);
  const [modalNovaTarefaAberto, setModalNovaTarefaAberto] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const showFeedback = (texto: string, tipo: 'sucesso' | 'erro') => {
    setFeedback({ texto, tipo });
    window.setTimeout(() => setFeedback(null), 3000);
  };

  const responsaveis = useMemo(() => {
    const mapa = new Map<string, UsuarioEquipe>();
    usuarios.forEach((usuario) => mapa.set(`config:${usuario.configUsuarioId}`, {
      id: `config:${usuario.configUsuarioId}`,
      nome: usuario.nome,
      configUsuarioId: usuario.configUsuarioId,
      userId: usuario.userId,
    }));
    tarefas.forEach((tarefa) => {
      if (!tarefa.responsavel || tarefa.responsavelConfigUsuarioId) return;
      mapa.set(`nome:${tarefa.responsavel}`, { id: `nome:${tarefa.responsavel}`, nome: tarefa.responsavel });
    });
    companyGroups.forEach((group) => {
      if (!group.responsavel) return;
      const jaExiste = Array.from(mapa.values()).some((usuario) => usuario.nome === group.responsavel);
      if (!jaExiste) mapa.set(`nome:${group.responsavel}`, { id: `nome:${group.responsavel}`, nome: group.responsavel });
    });
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [companyGroups, tarefas, usuarios]);

  const selectedUser = useMemo(
    () => responsaveis.find((usuario) => usuario.id === selectedUserId) || null,
    [responsaveis, selectedUserId],
  );

  const userStats = useMemo(
    () => getUserStats(responsaveis, tarefas, companyGroups),
    [companyGroups, responsaveis, tarefas],
  );

  const filteredTasks = useMemo(() => {
    if (!selectedUser || periodo === 'empresas') return [];
    return tarefas
      .filter((tarefa) => {
        const pertenceAoUsuario = selectedUser.configUsuarioId
          ? tarefa.responsavelConfigUsuarioId === selectedUser.configUsuarioId
          : !tarefa.responsavelConfigUsuarioId && tarefa.responsavel === selectedUser.nome;
        return pertenceAoUsuario && isTaskInPeriod(tarefa, periodo, dataBase);
      })
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [dataBase, periodo, selectedUser, tarefas]);

  const userCompanyGroups = useMemo(() => {
    if (!selectedUser) return [];
    return companyGroups.filter((group) => group.responsavel === selectedUser.nome);
  }, [companyGroups, selectedUser]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return filteredTasks[0] || null;
    return filteredTasks.find((task) => task.id === selectedTaskId) || filteredTasks[0] || null;
  }, [filteredTasks, selectedTaskId]);

  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return userCompanyGroups[0] || null;
    return userCompanyGroups.find((group) => group.id === selectedCompanyId) || userCompanyGroups[0] || null;
  }, [selectedCompanyId, userCompanyGroups]);

  const taskSummary = useMemo(() => getTaskSummary(filteredTasks), [filteredTasks]);

  const resetSelection = () => {
    setSelectedTaskId(null);
    setSelectedCompanyId(null);
  };

  const handleChangePeriodo = (nextPeriodo: PeriodoFiltro) => {
    setPeriodo(nextPeriodo);
    resetSelection();
  };

  const handleVincularRotina = (rotinaId: string, incluirFinaisDeSemana: boolean) => {
    const rotina = rotinas.find((item) => item.id === rotinaId);
    if (!rotina || !selectedUser) return;

    saveRotina({
      ...rotina,
      id: `rotina-vinculada-${Date.now()}`,
      responsavel: selectedUser.nome,
      responsavelUserId: selectedUser.userId,
      responsavelConfigUsuarioId: selectedUser.configUsuarioId,
      proximaExecucao: todayKey(),
      incluirFinaisDeSemana,
      ativa: true,
    });
    setModalVincularAberto(false);
  };

  const handleCriarTarefaManual = (dados: any) => {
    if (!selectedUser) return;
    const nova: TarefaGestor = {
      ...dados,
      id: `task-manual-${Date.now()}`,
      frequencia: 'Única',
      responsavel: selectedUser.nome,
      responsavelUserId: selectedUser.userId,
      responsavelConfigUsuarioId: selectedUser.configUsuarioId,
      cliente: dados.cliente || 'Escritório',
      origem: 'Gestor',
      status: 'Pendente',
      checklist: dados.checklist.map((item: string) => ({ titulo: item, concluida: false })),
    };
    saveTarefaAsync(nova)
      .then(() => {
        showFeedback('Tarefa criada com sucesso para o responsável.', 'sucesso');
        setModalNovaTarefaAberto(false);
      })
      .catch(() => {
        showFeedback('Não foi possível criar a tarefa. Tente novamente.', 'erro');
      });
  };

  if (!selectedUser) {
    return (
      <UserCardsGrid
        users={userStats}
        onSelectUser={(id) => {
          setSelectedUserId(id);
          resetSelection();
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <UserHeader
        selectedUser={selectedUser.nome}
        onBack={() => setSelectedUserId(null)}
        onNovaAtividade={() => setModalNovaTarefaAberto(true)}
        onVincularRotina={() => setModalVincularAberto(true)}
      />

      {feedback && (
        <div style={{ color: feedback.tipo === 'sucesso' ? '#166534' : '#b91c1c', fontWeight: 600 }}>
          {feedback.texto}
        </div>
      )}

      <PeriodToolbar
        dataBase={dataBase}
        periodo={periodo}
        onChangePeriodo={handleChangePeriodo}
        onShiftDate={(amount) => setDataBase(shiftPeriodDate(periodo, dataBase, amount))}
      />

      {periodo !== 'empresas' ? (
        <>
          <TaskSummaryCards summary={taskSummary} />
          <TaskInspector
            deleteTarefa={deleteTarefa}
            filteredTasks={filteredTasks}
            selectedTask={selectedTask}
            setSelectedTaskId={setSelectedTaskId}
            taskSummary={taskSummary}
            toggleChecklist={toggleChecklist}
            updateTarefa={updateTarefa}
          />
        </>
      ) : (
        <CompanyInspector
          handleToggleStep={handleToggleStep}
          selectedCompany={selectedCompany}
          setSelectedCompanyId={setSelectedCompanyId}
          userCompanyGroups={userCompanyGroups}
        />
      )}

      <ModalVincularRotina
        aberto={modalVincularAberto}
        onClose={() => setModalVincularAberto(false)}
        rotinas={rotinas.filter((rotina) => rotina.ativa)}
        onVincular={handleVincularRotina}
        usuarioNome={selectedUser.nome}
      />
      <ModalNovaTarefa
        aberto={modalNovaTarefaAberto}
        onClose={() => setModalNovaTarefaAberto(false)}
        onSalvar={handleCriarTarefaManual}
        usuarioNome={selectedUser.nome}
      />
    </div>
  );
};
