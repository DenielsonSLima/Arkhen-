import { useEffect, useMemo, useState } from 'react';
import type { PerfilAcesso } from '../services/perfisService';
import { useDeletePerfilAcessoMutation, usePerfisAcessoQuery, useSavePerfilAcessoMutation } from '../queries/usePerfisQueries';

export const usePerfisAcesso = () => {
  const perfisQuery = usePerfisAcessoQuery();
  const savePerfil = useSavePerfilAcessoMutation();
  const deletePerfil = useDeletePerfilAcessoMutation();
  const [editingPerfil, setEditingPerfil] = useState<PerfilAcesso | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PerfilAcesso | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (perfisQuery.error) {
      setErrorMsg('Erro ao carregar perfis de acesso no Supabase.');
    }
  }, [perfisQuery.error]);

  const perfis = useMemo(() => perfisQuery.data || [], [perfisQuery.data]);

  const handleSave = async (input: { nome: string; descricao: string; permissoes: string[] }) => {
    setErrorMsg(null);
    try {
      await savePerfil.mutateAsync({
        id: editingPerfil?.id,
        nome: input.nome,
        descricao: input.descricao,
        permissoes: input.permissoes,
      });
      setEditingPerfil(null);
      setSuccessMsg(editingPerfil?.id ? 'Perfil atualizado com sucesso.' : 'Perfil criado com sucesso.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar perfil de acesso.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setErrorMsg(null);
    try {
      await deletePerfil.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      setSuccessMsg('Perfil inativado com sucesso.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao inativar perfil.');
    }
  };

  return {
    perfis,
    isLoading: perfisQuery.isLoading,
    isSaving: savePerfil.isPending,
    isDeleting: deletePerfil.isPending,
    editingPerfil,
    setEditingPerfil,
    deleteTarget,
    setDeleteTarget,
    successMsg,
    errorMsg,
    setErrorMsg,
    handleSave,
    handleDelete,
  };
};
