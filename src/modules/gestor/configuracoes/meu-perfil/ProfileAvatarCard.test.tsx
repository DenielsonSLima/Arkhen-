/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfileAvatarCard } from './ProfileAvatarCard';

describe('ProfileAvatarCard', () => {
  it('explica a foto do Google e exige confirmação para usar iniciais', () => {
    const onRemove = vi.fn();
    render(
      <ProfileAvatarCard
        nome="Pessoa Real"
        perfil="Gestor"
        avatar="https://google.example/avatar.jpg"
        avatarSource="google"
        isBusy={false}
        onFileSelected={vi.fn()}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText(/foto importada da sua conta Google/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /usar iniciais/i }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /remover foto/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
