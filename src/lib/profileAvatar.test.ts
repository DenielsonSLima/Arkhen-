import { describe, expect, it } from 'vitest';
import {
  buildProfileMetadata,
  getAvatarSourceDescription,
  getProfileInitials,
  resolveProfileAvatar,
} from './profileAvatar';

describe('profileAvatar', () => {
  it('identifica a foto importada da identidade Google', () => {
    expect(resolveProfileAvatar({
      metadata: { picture: 'https://google.example/avatar.jpg' },
      googleIdentityData: { picture: 'https://google.example/avatar.jpg' },
      hasGoogleIdentity: true,
    })).toEqual({
      avatar: 'https://google.example/avatar.jpg',
      avatarSource: 'google',
    });
  });

  it('preserva a escolha explícita de usar iniciais sem reimportar o Google', () => {
    expect(resolveProfileAvatar({
      metadata: {
        avatar_source: 'conta',
        avatar_url: null,
        picture: null,
      },
      googleIdentityData: { picture: 'https://google.example/avatar.jpg' },
      hasGoogleIdentity: true,
    })).toEqual({ avatar: '', avatarSource: 'conta' });
  });

  it('migra uma foto manual do formato legado', () => {
    expect(resolveProfileAvatar({
      storedAvatar: 'https://storage.example/manual.webp',
      storedAvatarSelectedByUser: true,
    })).toEqual({
      avatar: 'https://storage.example/manual.webp',
      avatarSource: 'manual',
    });
  });

  it('grava origem manual e limpa o picture herdado no upload', () => {
    expect(buildProfileMetadata({
      nome: 'Pessoa Real',
      cpf: '',
      dataNascimento: '',
      avatar: 'https://storage.example/manual.webp',
      avatarSource: 'manual',
    })).toMatchObject({
      avatar_url: 'https://storage.example/manual.webp',
      avatar_source: 'manual',
      picture: null,
    });
  });

  it('limpa os metadados da foto ao optar por iniciais', () => {
    expect(buildProfileMetadata({
      nome: 'Pessoa Real',
      cpf: '',
      dataNascimento: '',
      avatar: '',
      avatarSource: 'conta',
    })).toMatchObject({
      avatar_url: null,
      avatar_source: 'conta',
      picture: null,
    });
  });

  it('explica a origem e calcula iniciais sem criar uma imagem', () => {
    expect(getAvatarSourceDescription('google', true)).toContain('importada da sua conta Google');
    expect(getProfileInitials('Maria dos Santos')).toBe('MD');
  });
});
