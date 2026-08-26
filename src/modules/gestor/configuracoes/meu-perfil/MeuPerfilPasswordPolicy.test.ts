import { describe, expect, it } from 'vitest';
import profileSource from './MeuPerfilConfig.tsx?raw';
import passwordFormSource from './ProfilePasswordForm.tsx?raw';

describe('Meu Perfil password policy', () => {
  it('reutiliza a política única de oito caracteres, letra e número', () => {
    expect(profileSource).toContain("import { validatePassword } from '../../../public/login/services/passwordPolicy'");
    expect(profileSource).toContain('validatePassword(newPassword)');
    expect(profileSource).not.toContain('newPassword.length <');
    expect(passwordFormSource).toContain('pelo menos 8 caracteres');
    expect(passwordFormSource).not.toContain('6 caracteres');
  });
});
