/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { parseFiscalXml } from '../../../../../documentos/xml/shared/xmlFiscalParser';
import { gerarNfsePdf } from './gerarNfsePdf';
import { isItabaiana, validationUrl } from './modelo';
import { exemploXml } from './exemplo.test-fixture';

const parse = (xml = exemploXml) => parseFiscalXml(xml).nfse!;
describe('Modelo próprio WebISS Itabaiana', () => {
  it('lê valores autorizados, RPS e tomador nos respectivos grupos ABRASF', () => {
    const nfse = parse();
    expect(nfse.numero).toBe('2026000000001');
    expect(nfse.dataEmissao).toContain('09/09/2026');
    expect(nfse.dataEmissao).toContain('10:30:00');
    expect(nfse.valorServicos).toMatch(/405,00/);
    expect(nfse.valorLiquido).toMatch(/390,78/);
    expect(nfse.valorIss).toMatch(/14,22/);
    expect(nfse.aliquota).toBe('3,5100%');
    expect(nfse.issRetido).toBe('1');
    expect(nfse.prestador.endereco).toContain('1169');
    expect(nfse.prestador.endereco).not.toContain('2026000000001');
    expect(nfse.municipioPrestacao).toBe('Itabaiana - SE');
    expect(nfse.tomador.nome).toContain('CLIENTE DEMONSTRATIVO');
  });
  it('não substitui campos ausentes por zero nem une descontos diferentes', () => {
    const nfse = parse(exemploXml.replace('<ValorIss>14.22</ValorIss>', '').replace('<DescontoCondicionado>0.00', '<DescontoCondicionado>10.00').replace('<DescontoIncondicionado>0.00', '<DescontoIncondicionado>20.00'));
    expect(nfse.valorIss).toBe('');
    expect(nfse.descontoCondicionado).toMatch(/10,00/);
    expect(nfse.descontoIncondicionado).toMatch(/20,00/);
    expect(nfse.qrPayload).toBe('');
  });
  it('não aplica brasão de SE a PB ou a outro órgão gerador', () => {
    expect(isItabaiana({ ...parse(), codigoMunicipioGerador: '2506900' })).toBe(false);
    expect(isItabaiana({ ...parse(), codigoMunicipioGerador: '', prestador: { ...parse().prestador, codigoMunicipio: '', uf: 'PB' } })).toBe(false);
  });
  it('preserva campos IBS/CBS sem somar valores ou confundir grupos', () => {
    const nfse = parse(exemploXml.replace('</InfNfse>', '<IBSCBS><valores><uf><vIBS>1.01</vIBS></uf><mun><vIBS>2.02</vIBS></mun></valores></IBSCBS></InfNfse>'));
    expect(nfse.complementoTributario).toEqual([
      { label: 'IBS/CBS 1 / valores / uf / vIBS', value: '1.01' }, { label: 'IBS/CBS 1 / valores / mun / vIBS', value: '2.02' },
    ]);
  });
  it('separa explicitamente os ambientes, incluindo XML de origem desconhecida', () => {
    const nfse = parse();
    const homologacao = gerarNfsePdf(nfse, { ambiente: 'homologacao' }).output();
    expect(homologacao).toContain('homologacao.webiss.com.br');
    expect(homologacao).not.toContain('itabaianase.webiss.com.br');
    expect(validationUrl('nao_identificado')).toBe('');
    expect(gerarNfsePdf(nfse, { ambiente: 'producao' }).output()).toContain('itabaianase.webiss.com.br');
  });
  it('pagina descrições extensas e não gera documento com XML sem identificação', () => {
    const nfse = parse();
    const pdf = gerarNfsePdf({ ...nfse, discriminacao: 'Serviço detalhado com descrição longa.\n'.repeat(180) }, { ambiente: 'homologacao' });
    expect(pdf.getNumberOfPages()).toBeGreaterThan(2);
    expect(() => gerarNfsePdf({ ...nfse, codigoVerificacao: '' }, { ambiente: 'producao' })).toThrow('não contém');
  });
});
