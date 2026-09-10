/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { parseFiscalXml } from '../../../../../documentos/xml/shared/xmlFiscalParser';
import { encodeItf, resolveBarcode } from './codigoBarras';
import { exemploXml } from './exemplo.test-fixture';
import { gerarNfsePdf } from './gerarNfsePdf';

const original = () => ({ ...parseFiscalXml(exemploXml).nfse!, numero: '2026000000292',
  chaveAcesso: '28029081235898750000107202600000029226080030631153',
  prestador: { ...parseFiscalXml(exemploXml).nfse!.prestador, documento: '35898750000107' } });

describe('Código de barras do quadro WebISS Itabaiana', () => {
  it('reproduz os 57 elementos lidos independentemente do selo original, inclusive zeros iniciais', () => {
    const value = resolveBarcode(original(), { ambiente: 'producao' });
    expect(value).toBe('0003063115');
    expect(encodeItf(value)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 1, 1, 1, 3, 1, 3, 3, 1, 3, 1, 1, 1,
      1, 1, 1, 3, 3, 3, 3, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1,
      1, 3, 1, 1, 3, 1, 3, 1, 1,
    ]);
  });
  it('confere o mesmo mapeamento em uma segunda nota pública de outro prestador', () => {
    expect(resolveBarcode({ ...original(), numero: '2026000000022',
      chaveAcesso: '28029081202263089000104202600000002226040028674188',
      prestador: { ...original().prestador, documento: '02.263.089/0001-04' },
    }, { ambiente: 'producao' })).toBe('0002867418');
  });
  it('não fabrica barras sem chave nem aproveita chave de outro documento', () => {
    const nfse = original();
    for (const change of [{ chaveAcesso: undefined }, { chaveAcesso: '3063115' },
      { chaveAcesso: nfse.chaveAcesso.replace('2802908', '2800308') }, { numero: '2026000000293' },
      { prestador: { ...nfse.prestador, documento: '11111111000111' } }]) {
      expect(resolveBarcode({ ...nfse, ...change }, { ambiente: 'producao' })).toBe('');
    }
    expect(resolveBarcode(nfse, { ambiente: 'nao_identificado' })).toBe('');
    expect(resolveBarcode(nfse, { ambiente: 'producao', demonstracao: true })).toBe('');
  });
  it('recusa dados que não sejam dígitos em quantidade par', () => {
    for (const invalid of ['', '1', '123', 'ABCD', '12 34', '12-34']) expect(() => encodeItf(invalid)).toThrow();
  });
  it('mantém nota curta em uma página e pagina descrição longa com o painel ampliado', () => {
    expect(gerarNfsePdf(original(), { ambiente: 'producao' }).getNumberOfPages()).toBe(1);
    expect(gerarNfsePdf({ ...original(), discriminacao: 'Descrição longa de serviço.\n'.repeat(180) },
      { ambiente: 'homologacao' }).getNumberOfPages()).toBeGreaterThan(2);
  });
});
