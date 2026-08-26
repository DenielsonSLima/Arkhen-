import { isKnownLegacyDemoEmail, isKnownLegacyDemoName } from '../../../../lib/legacyDemoProfile';
import { persistedStorage } from '../../../../lib/persistedStorage';
import {
  normalizeAvatarSource,
  sanitizeProfileAvatar,
  type AvatarSource,
} from '../../../../lib/profileAvatar';

export interface UserProfile {
  nome: string;
  email: string;
  perfil: string;
  avatar: string;
  avatarSource: AvatarSource;
  cpf: string;
  dataNascimento: string;
  googleLinked: boolean;
  googleEmail?: string;
}

const DEFAULT_USER: UserProfile = {
  nome: 'Usuário',
  email: '',
  perfil: 'Usuário',
  avatar: '',
  avatarSource: 'conta',
  cpf: '',
  dataNascimento: '',
  googleLinked: false,
};

type StoredUserProfile = Partial<UserProfile> & { avatarSelectedByUser?: boolean };

const normalizeStoredProfile = (storedProfile: StoredUserProfile): UserProfile => {
  const avatar = sanitizeProfileAvatar(storedProfile.avatar);
  const legacyManual = storedProfile.avatarSelectedByUser === true && Boolean(avatar);
  return {
    ...DEFAULT_USER,
    ...storedProfile,
    nome: !storedProfile.nome || isKnownLegacyDemoName(storedProfile)
      ? DEFAULT_USER.nome
      : storedProfile.nome,
    email: isKnownLegacyDemoEmail(storedProfile.email) ? '' : storedProfile.email || '',
    avatar,
    avatarSource: normalizeAvatarSource(storedProfile.avatarSource)
      || (legacyManual ? 'manual' : 'conta'),
  };
};

export const getStoredProfile = (): UserProfile => {
  try {
    const saved = persistedStorage.getItem('gestor_user_profile');
    return saved ? normalizeStoredProfile(JSON.parse(saved)) : DEFAULT_USER;
  } catch (error) {
    console.error('Erro ao carregar perfil local:', error);
    return DEFAULT_USER;
  }
};
