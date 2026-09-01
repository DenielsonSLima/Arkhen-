import { describe, expect, it } from 'vitest';
import {
  evidenceRequiredError,
  getProtocolosErrorMessage,
  mapProtocolosError,
  ProtocolosError,
} from './protocolosError';

describe('protocolosError', () => {
  it('traduz a exigência de evidência sem expor detalhes internos', () => {
    const result = mapProtocolosError({
      code: '22023',
      message: 'Dados de protocolo inválidos; a transição exige evidência.',
      details: 'internal detail',
    });

    expect(result).toMatchObject({ code: 'evidence_required' });
    expect(result.message).toContain('pelo menos 8 caracteres');
    expect(result.message).not.toContain('internal detail');
  });

  it('traduz negação de permissão para uma mensagem segura', () => {
    const result = mapProtocolosError({
      code: '42501',
      message: 'permission denied for table protocolos_entregas',
    });

    expect(result).toMatchObject({ code: 'forbidden' });
    expect(result.message).not.toContain('protocolos_entregas');
  });

  it('preserva erros tipados do módulo', () => {
    const original = evidenceRequiredError();
    expect(mapProtocolosError(original)).toBe(original);
    expect(getProtocolosErrorMessage(original)).toBe(original.message);
    expect(original).toBeInstanceOf(ProtocolosError);
  });

  it('traduz conflito de edição concorrente sem expor o banco', () => {
    const result = mapProtocolosError({
      code: '40001',
      message: 'serialization_failure: row changed',
    });

    expect(result).toMatchObject({ code: 'conflict' });
    expect(result.message).toContain('outra tela');
    expect(result.message).not.toContain('serialization_failure');
  });
});
