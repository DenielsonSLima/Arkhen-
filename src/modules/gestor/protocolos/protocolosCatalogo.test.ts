import { describe, expect, it } from 'vitest';
import { ENTREGA_CATALOGO } from './protocolosCatalogo';
import { protocolosCatalogoService } from './services/protocolosCatalogoService';

describe('catálogo contábil padrão', () => {
  it('disponibiliza MIT e os oito controles tributários da referência', () => {
    const byId = new Map(ENTREGA_CATALOGO.map((item) => [item.id, item]));
    expect(byId.get('mit')).toMatchObject({ categoria: 'Obrigações Acessórias' });
    expect([
      'irpj-csll-trimestral', 'pis-cofins', 'iss-iss-retido', 'fecoep-saidas',
      'fecoep-entradas', 'icms-difal', 'icms-normal', 'icms-antecipado',
    ].every((id) => byId.get(id)?.categoria === 'Tributos')).toBe(true);
  });

  it('restringe os novos tributos aos regimes de lucro normal', () => {
    const presumido = protocolosCatalogoService.getCatalogoPorRegime('Lucro Presumido');
    const simples = protocolosCatalogoService.getCatalogoPorRegime('Simples Nacional');
    expect(presumido.some((item) => item.id === 'mit')).toBe(true);
    expect(presumido.some((item) => item.id === 'icms-difal')).toBe(true);
    expect(simples.some((item) => item.id === 'mit')).toBe(false);
    expect(simples.some((item) => item.id === 'icms-difal')).toBe(false);
  });

  it('não presume vencimentos que não aparecem nas evidências operacionais', () => {
    expect(protocolosCatalogoService.getById('mit')?.temVencimento).toBe(false);
    expect(protocolosCatalogoService.getById('fecoep-saidas')?.temVencimento).toBe(false);
    expect(protocolosCatalogoService.getById('nfs')?.origemPadrao).toBe('Cliente envia');
    expect(protocolosCatalogoService.getById('irpj-csll-trimestral')?.temVencimento).toBe(true);
  });
});
