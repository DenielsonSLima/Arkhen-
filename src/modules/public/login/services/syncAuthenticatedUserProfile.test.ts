import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('../../../../lib/persistedStorage', () => ({ persistedStorage: storage }));

import { syncAuthenticatedUserProfile } from './syncAuthenticatedUserProfile';

const authUser = (metadata: Record<string, unknown>, google = false) => ({
  id: 'usuario-real',
  email: 'pessoa@empresa.com.br',
  user_metadata: metadata,
  app_metadata: google ? { provider: 'google', providers: ['google'] } : {},
  identities: google ? [{
    provider: 'google',
    identity_data: { picture: 'https://provedor/foto.jpg' },
  }] : [],
});

describe('syncAuthenticatedUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getItem.mockReturnValue(null);
  });

  it('identifica claramente a foto importada do Google', () => {
    syncAuthenticatedUserProfile(
      authUser({ name: 'Pessoa Real', picture: 'https://provedor/foto.jpg' }, true) as never,
    );

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.nome).toBe('Usuário');
    expect(saved.avatar).toBe('https://provedor/foto.jpg');
    expect(saved.avatarSource).toBe('google');
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
    expect(saved.avatarSource).toBe('manual');
  });

  it('preserva uma pessoa real chamada João Silva sem sinais de demonstração', () => {
    storage.getItem.mockReturnValue(JSON.stringify({
      nome: 'João Silva',
      email: 'pessoa@empresa.com.br',
    }));

    syncAuthenticatedUserProfile(authUser({}) as never);

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.nome).toBe('João Silva');
  });

  it('descarta a identidade legada quando o nome vem acompanhado do e-mail demo exato', () => {
    storage.getItem.mockReturnValue(JSON.stringify({
      nome: 'João Silva',
      email: 'joao.silva@arkhen.com.br',
    }));

    syncAuthenticatedUserProfile(authUser({}) as never);

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.nome).toBe('Usuário');
    expect(saved.email).toBe('pessoa@empresa.com.br');
  });

  it('descarta qualquer foto antiga sem consentimento explícito', () => {
    storage.getItem.mockReturnValue(JSON.stringify({
      nome: 'Pessoa Real',
      avatar: 'https://origem-desconhecida/foto.jpg',
    }));

    syncAuthenticatedUserProfile(authUser({ name: 'Pessoa Real' }) as never);

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.avatar).not.toBe('https://origem-desconhecida/foto.jpg');
    expect(saved.avatar).toBe('');
    expect(saved.avatarSource).toBe('conta');
  });

  it('não reimporta foto do Google depois da escolha explícita por iniciais', () => {
    syncAuthenticatedUserProfile(authUser({
      avatar_source: 'conta',
      avatar_url: null,
      picture: null,
    }, true) as never);

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.avatar).toBe('');
    expect(saved.avatarSource).toBe('conta');
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

  it('preserva o nome editado no app acima do nome operacional anterior', () => {
    syncAuthenticatedUserProfile(
      authUser({ nome: 'Nome Atualizado', name: 'Nome do Google' }) as never,
      { nome: 'Nome Operacional Anterior', perfil: 'Auxiliar' },
    );

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.nome).toBe('Nome Atualizado');
  });

  it('adota perfil neutro quando a autorização não informa um cargo', () => {
    syncAuthenticatedUserProfile(authUser({ name: 'Pessoa Real' }) as never);

    const saved = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(saved.perfil).toBe('Usuário');
  });
});
