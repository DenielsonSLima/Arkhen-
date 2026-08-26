import type { User } from '@supabase/supabase-js';
import { persistedStorage } from '../../../../lib/persistedStorage';
import {
  isKnownLegacyDemoAvatar,
  isKnownLegacyDemoEmail,
  isKnownLegacyDemoName,
} from '../../../../lib/legacyDemoProfile';

export interface AuthorizedUserProfile {
  nome?: string | null;
  email?: string | null;
  perfil?: string | null;
}

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

export const syncAuthenticatedUserProfile = (
  user: User,
  authorizedProfile?: AuthorizedUserProfile | null,
) => {
  try {
    const metadata = user.user_metadata || {};
    const saved = persistedStorage.getItem('gestor_user_profile');
    let localProfile: Record<string, any> = {};
    if (saved) {
      try {
        localProfile = JSON.parse(saved);
      } catch (error) {
        console.error('Erro ao ler perfil do usuário local:', error);
      }
    }
    const storedName = isKnownLegacyDemoName(localProfile) ? '' : localProfile.nome;
    const storedEmail = isKnownLegacyDemoEmail(localProfile.email) ? '' : localProfile.email;
    const storedAvatar = isKnownLegacyDemoAvatar(localProfile.avatar)
      || localProfile.avatar?.startsWith('data:image/svg+xml')
      ? ''
      : localProfile.avatar;
    const nome = typeof metadata.nome === 'string' && metadata.nome.trim()
      ? metadata.nome.trim()
      : authorizedProfile?.nome?.trim()
      || storedName
      || 'Usuário';
    const avatarWasExplicitlySelected = localProfile.avatarSelectedByUser === true;
    const avatar = avatarWasExplicitlySelected && storedAvatar
      ? storedAvatar
      : createInitialsAvatar(nome);
    persistedStorage.setItem('gestor_user_profile', JSON.stringify({
      nome,
      email: user.email || authorizedProfile?.email?.trim() || storedEmail || '',
      perfil: authorizedProfile?.perfil?.trim() || 'Usuário',
      avatar,
      avatarSelectedByUser: avatarWasExplicitlySelected,
      googleLinked: localProfile.googleLinked || false,
      googleEmail: localProfile.googleEmail || undefined,
    }));
    window.dispatchEvent(new Event('profile_updated'));
  } catch (error) {
    console.error('Erro ao sincronizar perfil do usuário localmente:', error);
  }
};
