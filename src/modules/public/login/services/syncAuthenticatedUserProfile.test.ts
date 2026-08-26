import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('../../../../lib/persistedStorage', () => ({ persistedStorage: storage }));

import { syncAuthenticatedUserProfile } from './syncAuthenticatedUserProfile';

const authUser = (metadata: Record<string, unknown>) => ({
  id: 'usuario-real',
  email: 'pessoa@empresa.com.br',
  user_metadata: metadata,
});

describe('syncAuthenticatedUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getItem.mockReturnValue(null);
  });

  it('não importa silenciosamente a foto do provedor', () => {
    syncAuthenticatedUserProfile(authUser({ name: 'Pessoa Real', picture: 'https://provedor/foto.jpg' }) as never);

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.avatar).not.toBe('https://provedor/foto.jpg');
    expect(saved.avatar).toContain('data:image/svg+xml');
    expect(saved.avatarSelectedByUser).toBe(false);
  });

  it('preserva a foto escolhida explicitamente pelo usuário', () => {
    storage.getItem.mockReturnValue(JSON.stringify({
      nome: 'Pessoa Real',
      avatar: 'https://storage/foto-escolhida.webp',
      avatarSelectedByUser: true,
    }));

    syncAuthenticatedUserProfile(authUser({ name: 'Pessoa Real', picture: 'https://provedor/foto.jpg' }) as never);

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.avatar).toBe('https://storage/foto-escolhida.webp');
    expect(saved.avatarSelectedByUser).toBe(true);
  });

  it('descarta qualquer foto antiga sem consentimento explícito', () => {
    storage.getItem.mockReturnValue(JSON.stringify({
      nome: 'Pessoa Real',
      avatar: 'https://origem-desconhecida/foto.jpg',
    }));

    syncAuthenticatedUserProfile(authUser({ name: 'Pessoa Real' }) as never);

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.avatar).not.toBe('https://origem-desconhecida/foto.jpg');
    expect(saved.avatar).toContain('data:image/svg+xml');
    expect(saved.avatarSelectedByUser).toBe(false);
  });

  it('usa o perfil autorizado do banco e nunca presume administrador', () => {
    syncAuthenticatedUserProfile(
      authUser({ name: 'Pessoa Real' }) as never,
      { nome: 'Pessoa Convidada', perfil: 'Auxiliar' },
    );

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.nome).toBe('Pessoa Convidada');
    expect(saved.perfil).toBe('Auxiliar');
  });

  it('adota perfil neutro quando a autorização não informa um cargo', () => {
    syncAuthenticatedUserProfile(authUser({ name: 'Pessoa Real' }) as never);

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.perfil).toBe('Usuário');
  });
});
