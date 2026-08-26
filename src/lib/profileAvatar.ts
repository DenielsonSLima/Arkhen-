import { isKnownLegacyDemoAvatar } from './legacyDemoProfile';

export type AvatarSource = 'google' | 'manual' | 'conta';

type AvatarMetadata = Record<string, unknown>;

interface ResolveProfileAvatarOptions {
  metadata?: AvatarMetadata | null;
  googleIdentityData?: AvatarMetadata | null;
  hasGoogleIdentity?: boolean;
  storedAvatar?: unknown;
  storedAvatarSource?: unknown;
  storedAvatarSelectedByUser?: boolean;
}

export interface ProfileMetadataInput {
  nome: string;
  cpf: string;
  dataNascimento: string;
  avatar: string;
  avatarSource: AvatarSource;
}

const readAvatar = (value: unknown) => typeof value === 'string'
  && value.trim()
  && !isKnownLegacyDemoAvatar(value)
  && !value.startsWith('data:image/svg+xml')
  ? value.trim()
  : '';

export const normalizeAvatarSource = (value: unknown): AvatarSource | null => (
  value === 'google' || value === 'manual' || value === 'conta' ? value : null
);

export const sanitizeProfileAvatar = (value: unknown) => readAvatar(value);

export const resolveProfileAvatar = ({
  metadata = {},
  googleIdentityData = {},
  hasGoogleIdentity = false,
  storedAvatar,
  storedAvatarSource,
  storedAvatarSelectedByUser = false,
}: ResolveProfileAvatarOptions): { avatar: string; avatarSource: AvatarSource } => {
  const explicitSource = normalizeAvatarSource(metadata?.avatar_source);
  const metadataAvatar = readAvatar(metadata?.avatar_url);
  const metadataPicture = readAvatar(metadata?.picture);
  const googleAvatar = readAvatar(
    googleIdentityData?.avatar_url || googleIdentityData?.picture,
  );
  const stored = readAvatar(storedAvatar);
  const legacyManualAvatar = storedAvatarSelectedByUser ? stored : '';

  if (explicitSource === 'conta') {
    return { avatar: metadataAvatar, avatarSource: 'conta' };
  }

  if (explicitSource === 'manual') {
    const avatar = metadataAvatar || legacyManualAvatar;
    return { avatar, avatarSource: avatar ? 'manual' : 'conta' };
  }

  if (explicitSource === 'google') {
    const avatar = metadataAvatar || metadataPicture || googleAvatar;
    return { avatar, avatarSource: avatar ? 'google' : 'conta' };
  }

  if (metadataAvatar) {
    const isGoogleAvatar = hasGoogleIdentity
      && (metadataAvatar === googleAvatar || metadataAvatar === metadataPicture);
    return {
      avatar: metadataAvatar,
      avatarSource: isGoogleAvatar ? 'google' : 'manual',
    };
  }

  if (metadataPicture && hasGoogleIdentity) {
    return { avatar: metadataPicture, avatarSource: 'google' };
  }

  if (googleAvatar && hasGoogleIdentity) {
    return { avatar: googleAvatar, avatarSource: 'google' };
  }

  if (legacyManualAvatar || normalizeAvatarSource(storedAvatarSource) === 'manual') {
    return {
      avatar: legacyManualAvatar || stored,
      avatarSource: legacyManualAvatar || stored ? 'manual' : 'conta',
    };
  }

  return {
    avatar: metadataPicture,
    avatarSource: 'conta',
  };
};

export const getProfileInitials = (name: string) => name
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part.charAt(0).toLocaleUpperCase('pt-BR'))
  .join('') || 'U';

export const getAvatarSourceDescription = (
  source: AvatarSource,
  hasAvatar: boolean,
) => {
  if (!hasAvatar) return 'Nenhuma foto selecionada. O sistema usa apenas suas iniciais.';
  if (source === 'google') {
    return 'Foto importada da sua conta Google. Você pode substituí-la ou removê-la sem desvincular o login.';
  }
  if (source === 'manual') return 'Foto enviada manualmente por você neste sistema.';
  return 'Foto associada à sua conta de acesso.';
};

export const buildProfileMetadata = ({
  nome,
  cpf,
  dataNascimento,
  avatar,
  avatarSource,
}: ProfileMetadataInput) => ({
  nome,
  cpf,
  data_nascimento: dataNascimento,
  avatar_url: avatar || null,
  avatar_source: avatar ? avatarSource : 'conta',
  ...(avatarSource === 'google' && avatar ? {} : { picture: null }),
});
