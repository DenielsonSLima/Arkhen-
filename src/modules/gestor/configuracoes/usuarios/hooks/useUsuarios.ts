import { useMemo, useState, type FormEvent } from 'react';
import type { SaveUsuarioInput, Usuario } from '../services/usuariosService';
import {
  useExcluirUsuarioMutation,
  useInativarUsuarioMutation,
  useRedefinirSenhaFuncionarioMutation,
  useSaveUsuarioMutation,
  useUsuariosQuery,
} from '../queries/useUsuariosQueries';
import { usePerfisAcessoQuery } from '../../perfis/queries/usePerfisQueries';
import {
  getDefaultCpfAccessProfile,
  validateUsuarioForm,
  type UsuarioFormErrors,
} from '../forms/usuarioFormModel';

const defaultForm = (perfil = 'Funcionário', perfilId?: string): SaveUsuarioInput => ({
  nome: '',
  formaAcesso: 'cpf',
  email: '',
  cpf: '',
  telefone: '',
  senha: '',
  confirmacaoSenha: '',
  perfilId,
  perfil,
  status: 'Ativo',
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
  formaAcesso: usuario.formaAcesso,
  email: usuario.email || '',
  cpf: usuario.cpf,
  telefone: usuario.telefone,
  senha: '',
  confirmacaoSenha: '',
  perfilId: usuario.perfilId || undefined,
  perfil: usuario.perfil,
  status: usuario.status,
  accessConfig: usuario.accessConfig,
});

export interface TemporaryAccessResult {
  usuarioNome: string;
  cpf: string;
  temporaryPassword: string;
}

export const useUsuarios = () => {
  const usuariosQuery = useUsuariosQuery();
  const perfisQuery = usePerfisAcessoQuery();
  const saveMutation = useSaveUsuarioMutation();
  const inativarMutation = useInativarUsuarioMutation();
  const resetPasswordMutation = useRedefinirSenhaFuncionarioMutation();
  const excluirMutation = useExcluirUsuarioMutation();
  const [showForm, setShowForm] = useState(false);
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const [passwordResetUsuario, setPasswordResetUsuario] = useState<Usuario | null>(null);
  const [temporaryAccessResult, setTemporaryAccessResult] = useState<TemporaryAccessResult | null>(null);
  const [formValue, setFormValue] = useState<SaveUsuarioInput>(() => defaultForm());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<UsuarioFormErrors>({});

  const perfis = useMemo(() => perfisQuery.data || [], [perfisQuery.data]);
  const usuarios = useMemo(() => usuariosQuery.data || [], [usuariosQuery.data]);

  const openCreate = () => {
    const defaultPerfil = getDefaultCpfAccessProfile(perfis);
    setSelectedUsuario(null);
    setFormValue(defaultForm(defaultPerfil?.nome || 'Funcionário', defaultPerfil?.id));
    setFormErrors({});
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEdit = (usuario: Usuario) => {
    setSelectedUsuario(usuario);
    const perfil = perfis.find((item) => item.nome === usuario.perfil);
    setFormValue({ ...toForm(usuario), perfilId: usuario.perfilId || perfil?.id });
    setFormErrors({});
    setErrorMsg(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedUsuario(null);
    setFormErrors({});
    setErrorMsg(null);
  };

  const updateFormValue = (value: SaveUsuarioInput) => {
    setFormValue(value);
    setFormErrors({});
    setErrorMsg(null);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);
    const validation = validateUsuarioForm(formValue, perfis);
    if (!validation.success) {
      setFormErrors(validation.errors);
      setErrorMsg(validation.message);
      return;
    }
    setFormErrors({});
    try {
      const result = await saveMutation.mutateAsync(validation.data);
      if (result.delivery?.type === 'temporary_password') {
        setTemporaryAccessResult({
          usuarioNome: result.usuario.nome,
          cpf: result.usuario.cpf,
          temporaryPassword: result.delivery.temporaryPassword,
        });
        saveMutation.reset();
        setSuccessMsg(null);
      } else if (result.delivery?.type === 'email_invite') {
        setSuccessMsg(`Convite enviado para ${result.delivery.email}.`);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        setSuccessMsg('Usuário atualizado com sucesso.');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
      closeForm();
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

  const openPasswordReset = (usuario: Usuario) => {
    setPasswordResetUsuario(usuario);
    setErrorMsg(null);
  };

  const closePasswordReset = () => {
    if (!resetPasswordMutation.isPending) setPasswordResetUsuario(null);
  };

  const handlePasswordReset = async (password: string) => {
    if (!passwordResetUsuario) return;
    await resetPasswordMutation.mutateAsync({ usuarioId: passwordResetUsuario.id, password });
    const nome = passwordResetUsuario.nome;
    setPasswordResetUsuario(null);
    setSuccessMsg(`Senha de ${nome} redefinida com sucesso.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const closeTemporaryAccessResult = () => {
    setTemporaryAccessResult(null);
    saveMutation.reset();
  };

  return {
    usuarios,
    perfis,
    isLoading: usuariosQuery.isLoading || perfisQuery.isLoading,
    isSaving: saveMutation.isPending,
    showForm,
    selectedUsuario,
    temporaryAccessResult,
    passwordResetUsuario,
    isResettingPassword: resetPasswordMutation.isPending,
    formValue,
    setFormValue: updateFormValue,
    formErrors,
    successMsg,
    errorMsg,
    openCreate,
    openEdit,
    closeForm,
    handleSave,
    handleInativar,
    handleExcluir,
    openPasswordReset,
    closePasswordReset,
    handlePasswordReset,
    closeTemporaryAccessResult,
  };
};
