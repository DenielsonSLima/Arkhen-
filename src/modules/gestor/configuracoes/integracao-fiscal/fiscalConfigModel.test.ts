import { afterEach, describe, expect, it, vi } from 'vitest';
import contentSource from './components/FiscalConfigContent.tsx?raw';
import controllerSource from './hooks/useFiscalConfigController.ts?raw';
import actionsSource from './hooks/useFiscalConfigActions.ts?raw';
import entrySource from './FiscalConfig.tsx?raw';
import modelSource from './fiscalConfigModel.ts?raw';
import { fiscalIntegrationService } from './services/fiscalIntegrationService';
import {
  buildFiscalLocationTree,
  filterFiscalHistory,
} from './fiscalConfigModel';
import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { NfsHistoryItem } from './services/fiscalIntegrationService';

const company = (id: string, nome: string): Company => ({
  id,
  nome,
  razaoSocial: nome,
  cnpj: '',
  tipo: 'MEI',
  categoriaCliente: 'Contabilidade',
  tipoEstabelecimento: 'Matriz',
  funcionariosCount: 0,
  status: 'Ativa',
  email: '',
  telefone: '',
  endereco: '',
  cep: '',
  bairro: '',
  contato: '',
  inscricaoEstadual: '',
  funcionarios: [],
  ferias: [],
  documentos: [],
  pastasDocumentos: [],
  categoriasDocumentos: [],
});

const historyItem = (
  id: string,
  overrides: Partial<NfsHistoryItem> = {},
): NfsHistoryItem => ({
  id,
  data: '2026-08-26',
  hora: '10:00',
  operacao: 'Consulta',
  numeroNfse: '42',
  protocolo: 'ABC',
  status: 'Sucesso',
  usuario: 'Administrador',
  mensagemPrefeitura: 'Consulta concluída',
  ...overrides,
});

describe('modelo estrutural da configuração fiscal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mantém todos os módulos extraídos abaixo de 500 linhas', () => {
    [entrySource, contentSource, controllerSource, actionsSource, modelSource].forEach((source) => {
      expect(source.split('\n').length).toBeLessThanOrEqual(500);
    });
  });

  it('preserva a árvore por UF e município para a empresa selecionada', () => {
    vi.spyOn(fiscalIntegrationService, 'getAvailablePrefeituraProfiles').mockReturnValue([
      { uf: 'SE', municipio: 'Aracaju' },
      { uf: 'SE', municipio: 'Itabaiana' },
    ] as never);

    const tree = buildFiscalLocationTree(
      'cliente-a',
      [company('cliente-a', 'Cliente A')],
      [{
        key: 'existente',
        companyId: 'cliente-a',
        companyName: 'Nome antigo',
        uf: 'SE',
        municipio: 'Aracaju',
        isActive: true,
      }],
    );

    expect(tree).toHaveLength(1);
    expect(tree[0].uf).toBe('SE');
    expect(tree[0].municipios.map((item) => item.municipio)).toEqual(['Aracaju', 'Itabaiana']);
    expect(tree[0].municipios[0].contexts[0]).toMatchObject({
      key: 'existente',
      companyName: 'Cliente A',
      isActive: true,
    });
  });

  it('preserva todos os filtros combinados do histórico', () => {
    const items = [
      historyItem('visible'),
      historyItem('old', { data: '2026-07-01' }),
      historyItem('error', { status: 'Erro' }),
      historyItem('other-operation', { operacao: 'Emissão' }),
      historyItem('other-note', { numeroNfse: '99' }),
      historyItem('other-text', { mensagemPrefeitura: 'Sem correspondência' }),
    ];

    expect(filterFiscalHistory(items, {
      periodoInicio: '2026-08-01',
      periodoFim: '2026-08-31',
      status: 'Sucesso',
      notaNum: '42',
      operacao: 'Consulta',
      searchQuery: 'consulta concluída',
    }).map((item) => item.id)).toEqual(['visible']);
  });
});
