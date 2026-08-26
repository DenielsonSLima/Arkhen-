import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  IdCard,
  Link as LinkIcon,
  Mail,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { persistedStorage } from '../../../../lib/persistedStorage';
import { uploadImageAsset } from '../../shared/uploadImageAsset';
import { passwordRecoveryService } from '../../../public/login/services/passwordRecoveryService';
import { validatePassword } from '../../../public/login/services/passwordPolicy';
import {
  buildProfileMetadata,
  resolveProfileAvatar,
} from '../../../../lib/profileAvatar';
import { ProfileAvatarCard } from './ProfileAvatarCard';
import { ProfilePasswordForm } from './ProfilePasswordForm';
import { getStoredProfile, type UserProfile } from './profileStorage';
export const MeuPerfilConfig: React.FC = () => {
  const googleAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true';
  const [activeTab, setActiveTab] = useState<'dados' | 'seguranca'>('dados');
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile);
  const [nome, setNome] = useState(profile.nome);
  const [email, setEmail] = useState(profile.email);
  const [cpf, setCpf] = useState(profile.cpf);
  const [dataNascimento, setDataNascimento] = useState(profile.dataNascimento);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const updateProfileData = (updated: UserProfile) => {
    setProfile(updated);
    persistedStorage.setItem('gestor_user_profile', JSON.stringify(updated));
    window.dispatchEvent(new Event('profile_updated'));
  };
  const showSuccess = (message: string) => {
    setSuccessMsg(message);
    setErrorMsg(null);
    window.setTimeout(() => setSuccessMsg(null), 3500);
  };

  const showError = (message: string) => {
    setErrorMsg(message);
    setSuccessMsg(null);
  };

  useEffect(() => {
    const loadAuthProfile = async () => {
      const [{ data: userData }, identitiesResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getUserIdentities(),
      ]);

      const user = userData.user;
      if (!user) return;

      const metadata = user.user_metadata || {};
      const googleIdentity = identitiesResult.data?.identities.find((identity) => identity.provider === 'google');
      const authProviders = Array.isArray(user.app_metadata?.providers)
        ? user.app_metadata.providers
        : [user.app_metadata?.provider];
      const localProfile = getStoredProfile();
      const resolvedAvatar = resolveProfileAvatar({
        metadata,
        googleIdentityData: googleIdentity?.identity_data,
        hasGoogleIdentity: Boolean(googleIdentity || authProviders.includes('google')),
        storedAvatar: localProfile.avatar,
        storedAvatarSource: localProfile.avatarSource,
      });
      const updated: UserProfile = {
        ...localProfile,
        nome: typeof metadata.nome === 'string' && metadata.nome.trim()
          ? metadata.nome.trim()
          : localProfile.nome,
        email: user.email || localProfile.email,
        avatar: resolvedAvatar.avatar,
        avatarSource: resolvedAvatar.avatarSource,
        cpf: metadata.cpf || localProfile.cpf || '',
        dataNascimento: metadata.data_nascimento || localProfile.dataNascimento || '',
        googleLinked: Boolean(googleIdentity),
        googleEmail: googleIdentity?.identity_data?.email || undefined,
      };

      updateProfileData(updated);
      setNome(updated.nome);
      setEmail(updated.email);
      setCpf(updated.cpf);
      setDataNascimento(updated.dataNascimento);
    };

    void loadAuthProfile().catch((error) => {
      console.error('Erro ao carregar perfil autenticado:', error);
    });
  }, []);

  const handleUpdateInfo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nome.trim() || !profile.email.trim()) {
      showError('Preencha nome e e-mail.');
      return;
    }

    setIsSavingInfo(true);
    try {
      const nextMetadata = buildProfileMetadata({
        nome: nome.trim(),
        cpf: cpf.trim(),
        dataNascimento,
        avatar: profile.avatar,
        avatarSource: profile.avatarSource,
      });
      const payload = { data: nextMetadata };
      const { data, error } = await supabase.auth.updateUser(payload);

      if (error) throw error;

      const updated = {
        ...profile,
        nome: nome.trim(),
        email: data.user.email || profile.email,
        cpf: cpf.trim(),
        dataNascimento,
      };
      updateProfileData(updated);
      showSuccess('Dados cadastrais atualizados.');
    } catch (error: any) {
      showError(error.message || 'Erro ao salvar os dados cadastrais.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      showError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('A confirmação não bate com a nova senha.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      showSuccess('Senha alterada com sucesso.');
    } catch (error: any) {
      showError(error.message || 'Erro ao alterar senha.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSendPasswordResetEmail = async () => {
    if (!profile.email) {
      showError('Não há e-mail cadastrado para enviar a redefinição de senha.');
      return;
    }

    setIsSendingResetEmail(true);
    try {
      await passwordRecoveryService.sendRecoveryEmail(profile.email);
      showSuccess(`E-mail de redefinição enviado para ${profile.email}.`);
    } catch (error: any) {
      showError(error.message || 'Erro ao enviar e-mail de redefinição.');
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const refreshGoogleStatus = async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) throw error;
    const googleIdentity = data.identities.find((identity) => identity.provider === 'google');
    const updated = {
      ...profile,
      googleLinked: Boolean(googleIdentity),
      googleEmail: googleIdentity?.identity_data?.email || undefined,
    };
    updateProfileData(updated);
  };

  const handleLinkGoogle = async () => {
    try {
      if (profile.googleLinked) {
        const { data, error } = await supabase.auth.getUserIdentities();
        if (error) throw error;
        const googleIdentity = data.identities.find((identity) => identity.provider === 'google');
        if (!googleIdentity) {
          await refreshGoogleStatus();
          return;
        }
        if (data.identities.length <= 1) {
          showError('Adicione outro método de login antes de desvincular o Google.');
          return;
        }
        const { error: unlinkError } = await supabase.auth.unlinkIdentity(googleIdentity);
        if (unlinkError) throw unlinkError;
        await refreshGoogleStatus();
        showSuccess('Vínculo com a conta Google removido.');
        return;
      }

      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (error: any) {
      showError(error.message || 'Erro ao atualizar vínculo com Google.');
    }
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error || new Error('Usuário autenticado não encontrado.');
      const publicUrl = await uploadImageAsset(file, 'avatars', data.user.id);
      const { error: updateError } = await supabase.auth.updateUser({
        data: buildProfileMetadata({
          nome: profile.nome,
          cpf: profile.cpf,
          dataNascimento: profile.dataNascimento,
          avatar: publicUrl,
          avatarSource: 'manual',
        }),
      });
      if (updateError) throw updateError;
      updateProfileData({ ...profile, avatar: publicUrl, avatarSource: 'manual' });
      showSuccess('Foto de perfil atualizada.');
    } catch (error: any) {
      showError(error.message || 'Erro ao enviar foto de perfil.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoRemove = async () => {
    setIsRemovingPhoto(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: buildProfileMetadata({
          nome: profile.nome,
          cpf: profile.cpf,
          dataNascimento: profile.dataNascimento,
          avatar: '',
          avatarSource: 'conta',
        }),
      });
      if (error) throw error;
      updateProfileData({ ...profile, avatar: '', avatarSource: 'conta' });
      showSuccess('Foto removida. Suas iniciais serão exibidas no perfil.');
    } catch (error: any) {
      showError(error.message || 'Erro ao remover a foto de perfil.');
    } finally {
      setIsRemovingPhoto(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px 10px 36px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '0.85rem',
    backgroundColor: '#ffffff',
    color: '#111827',
    width: '100%',
    boxSizing: 'border-box',
  };

  const tabButtonStyle = (tab: 'dados' | 'seguranca'): React.CSSProperties => ({
    alignItems: 'center',
    backgroundColor: activeTab === tab ? '#ffffff' : 'transparent',
    border: activeTab === tab ? '1px solid #e2e8f0' : '1px solid transparent',
    borderRadius: '8px',
    boxShadow: activeTab === tab ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
    color: activeTab === tab ? '#1e293b' : '#64748b',
    cursor: 'pointer',
    display: 'inline-flex',
    fontSize: '0.82rem',
    fontWeight: 700,
    gap: '8px',
    minHeight: '38px',
    padding: '8px 14px',
  });

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header">
        <h2>Meu Perfil</h2>
        <p>Gerencie dados pessoais, login, segurança e foto do seu usuário.</p>
      </div>

      {successMsg && (
        <div className="success-banner" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ display: 'inline-flex', gap: 6, padding: 4, backgroundColor: '#f1f5f9', borderRadius: 10, marginTop: 12 }}>
        <button type="button" style={tabButtonStyle('dados')} onClick={() => setActiveTab('dados')}>
          <User size={15} /> Dados pessoais
        </button>
        <button type="button" style={tabButtonStyle('seguranca')} onClick={() => setActiveTab('seguranca')}>
          <ShieldCheck size={15} /> Segurança
        </button>
      </div>

      {activeTab === 'dados' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.8fr) minmax(320px, 1.2fr)', gap: '28px', marginTop: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <ProfileAvatarCard
            nome={profile.nome}
            perfil={profile.perfil}
            avatar={profile.avatar}
            avatarSource={profile.avatarSource}
            isBusy={isUploadingPhoto || isRemovingPhoto}
            onFileSelected={handlePhotoUpload}
            onRemove={handlePhotoRemove}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <form onSubmit={handleUpdateInfo} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0, letterSpacing: '0.04em' }}>
              Dados Cadastrais
            </h4>

            {[
              { label: 'Nome Completo', value: nome, setter: setNome, type: 'text', icon: <User size={15} />, required: true, readOnly: false },
              { label: 'E-mail corporativo', value: email, setter: setEmail, type: 'email', icon: <Mail size={15} />, required: true, readOnly: true },
              { label: 'CPF', value: cpf, setter: setCpf, type: 'text', icon: <IdCard size={15} />, required: false, readOnly: false },
              { label: 'Data de nascimento', value: dataNascimento, setter: setDataNascimento, type: 'date', icon: <Calendar size={15} />, required: false, readOnly: false },
            ].map((field) => (
              <div key={field.label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{field.label}</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex' }}>{field.icon}</span>
                  <input type={field.type} value={field.value} onChange={(event) => field.setter(event.target.value)} style={inputStyle} required={field.required} disabled={isSavingInfo || field.readOnly} />
                </div>
              </div>
            ))}

            <p style={{ margin: '-4px 0 0', color: '#64748b', fontSize: '0.72rem', lineHeight: 1.45 }}>O e-mail é o identificador de acesso e não pode ser alterado neste formulário.</p>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-save-settings" disabled={isSavingInfo}>
                <Save size={14} /> {isSavingInfo ? 'Salvando...' : 'Salvar Cadastro'}
              </button>
            </div>
          </form>

        </div>
      </div>
      )}

      {activeTab === 'seguranca' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr)', gap: '24px', marginTop: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <ProfilePasswordForm
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            isChanging={isChangingPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onSubmit={handleChangePassword}
          />

          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0, letterSpacing: '0.04em' }}>
              Redefinição por E-mail
            </h4>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', lineHeight: 1.45 }}>
              Envia um link seguro para o e-mail cadastrado. Esse é o caminho recomendado quando quiser confirmar a troca fora da sessão atual.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <span style={{ color: '#1e293b', fontSize: '0.82rem', fontWeight: 700 }}>{profile.email}</span>
              <button type="button" className="btn-save-settings" onClick={handleSendPasswordResetEmail} disabled={isSendingResetEmail}>
                <Mail size={14} /> {isSendingResetEmail ? 'Enviando...' : 'Enviar e-mail'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {googleAuthEnabled && (
          <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: 0, letterSpacing: '0.04em' }}>
              Conta Google
            </h4>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem', lineHeight: 1.45 }}>
              Vincule ou desvincule o login pelo Google. Quando uma foto vier dessa conta, sua origem será identificada e você poderá substituí-la ou usar iniciais.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #cbd5e1' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '0.82rem', color: '#1e293b' }}>Google Account</strong>
                <span style={{ fontSize: '0.72rem', color: profile.googleLinked ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                  {profile.googleLinked ? `Vinculado: ${profile.googleEmail || profile.email}` : 'Não conectado'}
                </span>
              </div>
              <button type="button" className="btn-save-settings" onClick={handleLinkGoogle}>
                <LinkIcon size={13} /> {profile.googleLinked ? 'Desvincular' : 'Vincular'}
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
