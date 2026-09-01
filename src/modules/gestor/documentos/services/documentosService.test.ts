import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({ supabase: supabaseMock }));
vi.mock('../../configuracoes/armazenamento/services/planosContratacaoService', () => ({
  planosContratacaoService: { assertCanUpload: vi.fn() },
}));

import { documentosService } from './documentosService';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const UPDATED_AT = '2026-09-01T21:30:00.000Z';

describe('documentosService.updateCompanyDocumentSettings', () => {
  beforeEach(() => {
    supabaseMock.rpc.mockReset();
    supabaseMock.rpc.mockResolvedValue({ data: { updated_at: UPDATED_AT }, error: null });
  });

  it('salva pela RPC com CAS e payload normalizado', async () => {
    await documentosService.updateCompanyDocumentSettings(COMPANY_ID, {
      pastasDocumentos: [
        ' Fiscal__2026 / Entradas ',
        'Fiscal 2026/Entradas',
        '',
        ' Financeiro ',
      ],
      categoriasDocumentos: [
        ' Contratos ',
        ' Fiscal ',
        'fiscal',
        ' Trabalhista ',
        ' Personalizada ',
      ],
      updatedAt: UPDATED_AT,
    });

    expect(supabaseMock.rpc).toHaveBeenCalledOnce();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('salvar_configuracao_documental_cliente_v1', {
      p_cliente_id: COMPANY_ID,
      p_pastas: ['Fiscal 2026/Entradas', 'Financeiro'],
      p_categorias: ['Fiscal', 'Personalizada'],
      p_expected_updated_at: UPDATED_AT,
    });
  });

  it('converte erro da RPC em erro de preferências documentais', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'A configuração foi alterada por outro usuário.' },
    });

    await expect(documentosService.updateCompanyDocumentSettings(COMPANY_ID, {
      pastasDocumentos: ['Fiscal'],
      categoriasDocumentos: ['Relatórios'],
      updatedAt: UPDATED_AT,
    })).rejects.toThrow(
      'Erro ao atualizar preferências de documentos: A configuração foi alterada por outro usuário.',
    );
  });
});
