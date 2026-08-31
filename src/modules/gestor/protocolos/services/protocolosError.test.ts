import { describe, expect, it } from 'vitest';
import { mapProtocolosError } from './protocolosError';

describe('mapProtocolosError', () => {
  it.each([
    [{ code: '22023' }, 'configuração mudou'],
    [{ status: 403 }, 'não tem permissão'],
    [{ code: 'PGRST202' }, 'atualização necessária'],
    [{ status: 404 }, 'atualização necessária'],
  ])('traduz erros operacionais sem expor detalhes do banco', (source, message) => {
    expect(mapProtocolosError(source, 'salvar').message).toContain(message);
  });

  it('mantém uma mensagem segura para falhas desconhecidas', () => {
    expect(mapProtocolosError({ message: 'detalhe interno' }, 'carregar').message)
      .toBe('Não foi possível carregar as obrigações. Tente novamente.');
  });
});
