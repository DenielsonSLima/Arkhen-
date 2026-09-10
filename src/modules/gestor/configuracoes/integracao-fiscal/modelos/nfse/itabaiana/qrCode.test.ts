import { describe, expect, it } from 'vitest';
import { resolveQrCode } from './qrCode';

describe('Destino do QR Code WebISS', () => {
  it('abre o portal do ambiente quando não há token ou link no XML', () => {
    expect(resolveQrCode('', { ambiente: 'homologacao' })).toEqual({
      payload: 'https://homologacao.webiss.com.br/externo/nfse/validar',
      caption: 'Escaneie e informe o código de verificação',
    });
  });
  it('preserva link recebido do mesmo ambiente e recusa endereço externo ou de outro ambiente', () => {
    const link = 'https://itabaianase.webiss.com.br/externo/nfse/validar?codigo=EXEMPLO';
    expect(resolveQrCode(link, { ambiente: 'producao' }).payload).toBe(link);
    expect(resolveQrCode(link, { ambiente: 'homologacao' }).payload).not.toBe(link);
    for (const invalid of ['javascript:alert(1)', 'https://example.com/externo/nfse/validar', 'https://itabaianase.webiss.com.br.evil.invalid/externo/nfse/validar']) {
      expect(resolveQrCode(invalid, { ambiente: 'producao' }).payload).toBe('https://itabaianase.webiss.com.br/externo/nfse/validar');
    }
  });
  it('preserva token opaco recebido, mas não o reaproveita em demonstração', () => {
    const token = 'VG9rZW4gYXJ0aWZpY2lhbCBhcGVuYXMgcGFyYSB0ZXN0ZQ==';
    expect(resolveQrCode(token, { ambiente: 'producao' })).toEqual({ payload: token,
      caption: 'Leia no portal WebISS: Validar NFS-e pelo QRCode' });
    expect(resolveQrCode(token, { ambiente: 'homologacao', demonstracao: true }).payload).toBe('https://homologacao.webiss.com.br/externo/nfse/validar');
  });
  it('não presume ambiente quando a origem do XML é desconhecida', () => {
    expect(resolveQrCode('https://itabaianase.webiss.com.br/externo/nfse/validar', { ambiente: 'nao_identificado' }).payload).toBe('');
  });
});
