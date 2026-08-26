import type { User } from '@supabase/supabase-js';
import { persistedStorage } from '../../../../lib/persistedStorage';
import {
  isKnownLegacyDemoAvatar,
  isKnownLegacyDemoEmail,
  isKnownLegacyDemoName,
} from '../../../../lib/legacyDemoProfile';
import { resolveProfileAvatar } from '../../../../lib/profileAvatar';

export interface AuthorizedUserProfile {
  nome?: string | null;
  email?: string | null;
  perfil?: string | null;
}

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
    const googleIdentity = user.identities?.find((identity) => identity.provider === 'google');
    const providers = Array.isArray(user.app_metadata?.providers)
      ? user.app_metadata.providers
      : [user.app_metadata?.provider];
    const resolvedAvatar = resolveProfileAvatar({
      metadata,
      googleIdentityData: googleIdentity?.identity_data,
      hasGoogleIdentity: Boolean(googleIdentity || providers.includes('google')),
      storedAvatar,
      storedAvatarSource: localProfile.avatarSource,
      storedAvatarSelectedByUser: localProfile.avatarSelectedByUser === true,
    });
    persistedStorage.setItem('gestor_user_profile', JSON.stringify({
      nome,
      email: user.email || authorizedProfile?.email?.trim() || storedEmail || '',
      perfil: authorizedProfile?.perfil?.trim() || 'Usuário',
      avatar: resolvedAvatar.avatar,
      avatarSource: resolvedAvatar.avatarSource,
      googleLinked: localProfile.googleLinked || false,
      googleEmail: localProfile.googleEmail || undefined,
    }));
    window.dispatchEvent(new Event('profile_updated'));
  } catch (error) {
    console.error('Erro ao sincronizar perfil do usuário localmente:', error);
  }
};
