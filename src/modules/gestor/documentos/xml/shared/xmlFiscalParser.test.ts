// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseFiscalXml } from './xmlFiscalParser';
import { exemploXml } from '../../../configuracoes/integracao-fiscal/modelos/nfse/itabaiana/exemplo.test-fixture';
const eventXml = (type: string, status?: string) => `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe"><evento><infEvento><tpEvento>${type}</tpEvento><detEvento><descEvento>${type === '110111' ? 'Cancelamento' : 'Carta de Correcao'}</descEvento></detEvento></infEvento></evento>${status ? `<retEvento><infEvento><tpEvento>${type}</tpEvento><cStat>${status}</cStat></infEvento></retEvento>` : ''}</procEventoNFe>`;
describe('classificação de eventos fiscais', () => {
  it('carta de correção autorizada não cancela nota', () => {
    expect(parseFiscalXml(eventXml('110110', '135')).isCanceled).toBe(false);
  });
  it.each([undefined, '573', '136'])('pedido de cancelamento sem confirmação %s não cancela nota', (status) => {
    expect(parseFiscalXml(eventXml('110111', status)).isCanceled).toBe(false);
  });
  it.each(['135', '155'])('cancelamento confirmado %s é identificado', (status) => {
    expect(parseFiscalXml(eventXml('110111', status)).kind).toBe('cancelado');
  });
});

describe('situação fiscal NFS-e', () => {
  it.each([
    ['', false, false],
    ['<NfseCancelamento/>', true, false],
    ['<NfseSubstituicao/>', false, true],
    ['<NfseCancelamento/><NfseSubstituicao/>', true, true],
  ])('identifica os eventos no retorno %s', (eventos, isCanceled, isSubstituted) => {
    const summary = parseFiscalXml(exemploXml.replace('</CompNfse>', `${eventos}</CompNfse>`));
    expect(summary).toMatchObject({ kind: 'nfse', isCanceled, isSubstituted });
  });
  it('não atribui substituição a XML inválido', () => {
    expect(parseFiscalXml('<CompNfse><NfseSubstituicao></CompNfse>')).toMatchObject({ kind: 'desconhecido', isSubstituted: false });
  });
});
