import { useMemo, useState, type FormEvent } from 'react';
import type { SaveUsuarioInput, Usuario } from '../services/usuariosService';
import {
  useExcluirUsuarioMutation,
  useInativarUsuarioMutation,
  useSaveUsuarioMutation,
  useUsuariosQuery,
} from '../queries/useUsuariosQueries';
import { usePerfisAcessoQuery } from '../../perfis/queries/usePerfisQueries';

const defaultForm = (perfil = 'Assistente'): SaveUsuarioInput => ({
  nome: '',
  email: '',
  cpf: '',
  telefone: '',
  perfil,
  status: 'Pendente',
  accessConfig: {
    enabled: false,
    days: [1, 2, 3, 4, 5],
    intervals: [{ start: '08:00', end: '18:00' }],
    message: 'Seu acesso não está permitido neste dia ou horário. Entre em contato com o gestor.',
  },
});

const toForm = (usuario: Usuario): SaveUsuarioInput => ({
  id: usuario.id,
  nome: usuario.nome,
  email: usuario.email,
  cpf: usuario.cpf,
  telefone: usuario.telefone,
  perfil: usuario.perfil,
  status: usuario.status,
  accessConfig: usuario.accessConfig,
});

export const useUsuarios = () => {
  const usuariosQuery = useUsuariosQuery();
  const perfisQuery = usePerfisAcessoQuery();
  const saveMutation = useSaveUsuarioMutation();
  const inativarMutation = useInativarUsuarioMutation();
  const excluirMutation = useExcluirUsuarioMutation();
  const [showForm, setShowForm] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const [formValue, setFormValue] = useState<SaveUsuarioInput>(() => defaultForm());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const perfis = useMemo(() => perfisQuery.data || [], [perfisQuery.data]);
  const usuarios = useMemo(() => usuariosQuery.data || [], [usuariosQuery.data]);

  const openCreate = () => {
    setSelectedUsuario(null);
    setFormValue(defaultForm(perfis[0]?.nome || 'Assistente'));
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEdit = (usuario: Usuario) => {
    setSelectedUsuario(usuario);
    setFormValue(toForm(usuario));
    setErrorMsg(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedUsuario(null);
    setErrorMsg(null);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    try {
      await saveMutation.mutateAsync(formValue);
      setSuccessMsg(formValue.id ? 'Usuário atualizado com sucesso.' : 'Usuário cadastrado com sucesso.');
      closeForm();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar usuário.');
    }
  };

  const handleInativar = async (usuario: Usuario) => {
    setErrorMsg(null);
    try {
      await inativarMutation.mutateAsync(usuario.id);
      setSuccessMsg(`Usuário ${usuario.nome} inativado.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao inativar usuário.');
    }
  };

  const handleExcluir = async (usuario: Usuario) => {
    setErrorMsg(null);
    try {
      await excluirMutation.mutateAsync(usuario);
      setSuccessMsg(`Usuário ${usuario.nome} excluído.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao excluir usuário.');
    }
  };

  return {
    usuarios,
    perfis,
    isLoading: usuariosQuery.isLoading || perfisQuery.isLoading,
    isSaving: saveMutation.isPending,
    showForm,
    selectedUsuario,
    formValue,
    setFormValue,
    successMsg,
    errorMsg,
    openCreate,
    openEdit,
    closeForm,
    handleSave,
    handleInativar,
    handleExcluir,
  };
};
