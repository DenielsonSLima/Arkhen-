/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { buildUnsignedRps } from '../../../../../../../../supabase/functions/_shared/webiss/rps';
import { parseFiscalXml } from '../../../../../documentos/xml/shared/xmlFiscalParser';
import { exemploXml } from './exemplo.test-fixture';
import { statusLabels } from './pdfLayout';
import { descricaoEnquadramento } from './servicos';

const parse = (xml = exemploXml) => parseFiscalXml(xml).nfse!;
describe('Contrato de apresentação WebISS Itabaiana', () => {
  it.each([['3.51', '3,5100%'], ['0.5', '0,5000%'], ['0.0351', '0,0351%'], ['0', '0,0000%']])(
    'preserva pontos percentuais do RPS (%s) na representação do retorno', (aliquotaIss, expected) => {
      const rps = buildUnsignedRps({
        rps: { numero: '101', serie: 'A', data: '2026-09-09' },
        prestador: { cnpj: '35898750000107', inscricaoMunicipal: '5938914' },
        tomador: { documento: '52998224725', razaoSocial: 'Pessoa de teste' },
        servico: { valor: 405, descricao: 'Teste do contrato', itemListaServico: '17.03', aliquotaIss,
          codigoMunicipio: '2802908', issRetido: '2', exigibilidadeIss: '1', optanteSimplesNacional: '1', incentivoFiscal: '2' },
      });
      const aliquota = new DOMParser().parseFromString(rps, 'application/xml').getElementsByTagName('Aliquota')[0].textContent;
      // Simula o campo devolvido, sem afirmar que houve autorização remota.
      expect(parse(exemploXml.replace('<Aliquota>3.5100</Aliquota>', `<Aliquota>${aliquota}</Aliquota>`)).aliquota).toBe(expected);
    },
  );
  it('preserva a incidência separada da prestação e não a inventa quando ausente', () => {
    expect(parse().municipioPrestacao).toBe('Itabaiana - SE');
    expect(parse().municipioIncidencia).toBe('Aracaju - SE');
    expect(parse(exemploXml.replace('<MunicipioIncidencia>2800308</MunicipioIncidencia>', '')).municipioIncidencia).toBe('');
  });
  it('não muda a escala anterior de outros municípios pelo endereço do prestador', () => {
    const xml = exemploXml.replace('<OrgaoGerador><CodigoMunicipio>2802908', '<OrgaoGerador><CodigoMunicipio>2800308')
      .replace('<Aliquota>3.5100</Aliquota>', '<Aliquota>0.0351</Aliquota>');
    expect(parse(xml).aliquota).toBe('3,5100%');
  });
  it('mantém cancelamento visível em todos os ambientes e em demonstração', () => {
    for (const ambiente of ['homologacao', 'producao', 'nao_identificado'] as const) {
      const labels = statusLabels({ ambiente, cancelada: true });
      expect(labels).toContain('NFS-e CANCELADA');
      if (ambiente === 'homologacao') expect(labels).toContain('HOMOLOGAÇÃO - SEM VALOR FISCAL');
    }
    expect(statusLabels({ ambiente: 'homologacao', demonstracao: true, cancelada: true })).toEqual([
      'MODELO DEMONSTRATIVO - SEM VALOR FISCAL', 'NFS-e CANCELADA',
    ]);
  });
  it('usa o item explícito para o enquadramento e preserva descrição recebida', () => {
    expect(descricaoEnquadramento(parse())).toContain('Planejamento, coordenação');
    expect(descricaoEnquadramento({ ...parse(), itemListaServico: '17.19', codigoServico: '1719' })).toContain('Contabilidade');
    expect(descricaoEnquadramento({ ...parse(), itemListaServico: '99.99', codigoServico: '9999' })).toBe('9999');
    const nfse = parse(exemploXml.replace('</Servico>', '<DescricaoItemListaServico>Descrição recebida no XML</DescricaoItemListaServico></Servico>'));
    expect(descricaoEnquadramento(nfse)).toBe('1703 - Descrição recebida no XML');
  });
});
