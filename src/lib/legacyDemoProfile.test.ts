import { describe, expect, it } from 'vitest';
import {
  isKnownLegacyDemoAvatar,
  isKnownLegacyDemoEmail,
  isKnownLegacyDemoName,
} from './legacyDemoProfile';

describe('legacyDemoProfile', () => {
  it('preserva uma pessoa real chamada João Silva', () => {
    expect(isKnownLegacyDemoName({
      nome: 'João Silva',
      email: 'joao@empresa-real.com.br',
      avatar: 'https://storage.empresa-real.com.br/avatar.webp',
    })).toBe(false);
  });

  it('reconhece o nome legado somente quando existe outro sinal confiável', () => {
    expect(isKnownLegacyDemoName({
      nome: 'João Silva',
      email: 'joao.silva@arkhen.com.br',
    })).toBe(true);
    expect(isKnownLegacyDemoName({
      nome: 'João Silva',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    })).toBe(true);
  });

  it('limita os sinais de e-mail e avatar aos valores legados exatos', () => {
    expect(isKnownLegacyDemoEmail('demo@arkhen.com.br')).toBe(true);
    expect(isKnownLegacyDemoEmail('joao@empresa-real.com.br')).toBe(false);
    expect(isKnownLegacyDemoAvatar(
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    )).toBe(true);
    expect(isKnownLegacyDemoAvatar('https://images.unsplash.com/foto-escolhida-pelo-usuario')).toBe(false);
  });
});
