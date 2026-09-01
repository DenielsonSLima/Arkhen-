import type { User } from '@supabase/supabase-js';
import { persistedStorage } from '../../../../lib/persistedStorage';

const LEGACY_DEMO_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';
const LEGACY_DEMO_NAMES = new Set(['João Silva', 'João Silva Demonstração']);
const LEGACY_DEMO_EMAILS = new Set(['joao.silva@arkhen.com.br', 'demo@arkhen.com.br']);

const createInitialsAvatar = (name: string) => {
  const initials = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).replace(/[^a-z0-9]/gi, '').toUpperCase())
    .join('') || 'U';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect width="150" height="150" rx="75" fill="#1e293b"/><text x="75" y="82" text-anchor="middle" font-family="Arial,sans-serif" font-size="52" font-weight="700" fill="#c59235">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

interface AuthenticatedProfileContext {
  nome?: string;
  email?: string;
  cpf?: string;
  perfil?: string;
  authMethod?: 'email' | 'cpf';
}

export const syncAuthenticatedUserProfile = (
  user: User,
  context: AuthenticatedProfileContext = {},
) => {
  try {
    const metadata = user.user_metadata || {};
    const isCpfAccount = context.authMethod
      ? context.authMethod === 'cpf'
      : user.app_metadata?.account_type === 'employee_cpf'
        || user.app_metadata?.login_method === 'cpf';
    const saved = persistedStorage.getItem('gestor_user_profile');
    let localProfile: Record<string, any> = {};
    if (saved) {
      try {
        localProfile = JSON.parse(saved);
      } catch (error) {
        console.error('Erro ao ler perfil do usuário local:', error);
      }
    }
    const storedName = LEGACY_DEMO_NAMES.has(localProfile.nome) ? '' : localProfile.nome;
    const storedEmail = LEGACY_DEMO_EMAILS.has(localProfile.email) ? '' : localProfile.email;
    const storedAvatar = localProfile.avatar === LEGACY_DEMO_AVATAR
      || localProfile.avatar?.startsWith('data:image/svg+xml')
      ? ''
      : localProfile.avatar;
    const nome = isCpfAccount
      ? context.nome || storedName || 'Usuário'
      : metadata.nome || metadata.name || context.nome || storedName || 'Usuário';
    persistedStorage.setItem('gestor_user_profile', JSON.stringify({
      nome,
      email: isCpfAccount ? '' : context.email || user.email || storedEmail || '',
      cpf: isCpfAccount
        ? context.cpf || localProfile.cpf || ''
        : context.cpf || metadata.cpf || localProfile.cpf || '',
      dataNascimento: metadata.data_nascimento || localProfile.dataNascimento || '',
      perfil: isCpfAccount
        ? context.perfil || localProfile.perfil || 'Funcionário'
        : context.perfil || metadata.perfil || localProfile.perfil || 'Administrador',
      authMethod: isCpfAccount ? 'cpf' : 'email',
      avatar: metadata.avatar_url || metadata.picture || storedAvatar || createInitialsAvatar(nome),
      googleLinked: localProfile.googleLinked || false,
      googleEmail: localProfile.googleEmail || undefined,
    }));
    window.dispatchEvent(new Event('profile_updated'));
  } catch (error) {
    console.error('Erro ao sincronizar perfil do usuário localmente:', error);
  }
};
