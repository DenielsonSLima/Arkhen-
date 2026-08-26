const LEGACY_DEMO_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';
const LEGACY_DEMO_EMAILS = new Set(['joao.silva@arkhen.com.br', 'demo@arkhen.com.br']);
const EXPLICIT_LEGACY_DEMO_NAME = 'João Silva Demonstração';
const LEGACY_DEMO_PERSON_NAME = 'João Silva';

type LegacyProfileSignals = {
  nome?: unknown;
  email?: unknown;
  avatar?: unknown;
};

export const isKnownLegacyDemoEmail = (email: unknown) => (
  typeof email === 'string' && LEGACY_DEMO_EMAILS.has(email.trim().toLowerCase())
);

export const isKnownLegacyDemoAvatar = (avatar: unknown) => (
  typeof avatar === 'string' && avatar.trim() === LEGACY_DEMO_AVATAR
);

export const isKnownLegacyDemoName = (profile: LegacyProfileSignals) => {
  if (profile.nome === EXPLICIT_LEGACY_DEMO_NAME) return true;
  if (profile.nome !== LEGACY_DEMO_PERSON_NAME) return false;

  return isKnownLegacyDemoEmail(profile.email) || isKnownLegacyDemoAvatar(profile.avatar);
};
