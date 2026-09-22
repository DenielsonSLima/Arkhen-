// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseFiscalXml } from './xmlFiscalParser';
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
