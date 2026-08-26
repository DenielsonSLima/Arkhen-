import { describe, expect, it } from 'vitest';
import profileSource from './MeuPerfilConfig.tsx?raw';

describe('Meu Perfil e-mail security', () => {
  it('mantém o e-mail autenticado somente leitura neste fluxo', () => {
    expect(profileSource).toContain("label: 'E-mail corporativo'");
    expect(profileSource).toContain("type: 'email'");
    expect(profileSource).toContain('readOnly: true');
    expect(profileSource).toContain('const payload = { data: nextMetadata }');
    expect(profileSource).not.toContain("{ email: email.trim(), data: nextMetadata }");
    expect(profileSource).not.toContain('Confirme o novo e-mail');
  });
});
