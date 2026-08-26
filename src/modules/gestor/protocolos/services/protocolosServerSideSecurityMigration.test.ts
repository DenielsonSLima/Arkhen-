import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260826025600_protocolos_operacionais_server_side.sql?raw';
import serviceSource from './protocolosService.ts?raw';

describe('protocolos operacionais server-side', () => {
  it('reconcilia o catálogo versionado antes de criar as RPCs', () => {
    const schemaPosition = migrationSql.indexOf('ADD COLUMN IF NOT EXISTS codigo text');
    const functionPosition = migrationSql.indexOf(
      'CREATE OR REPLACE FUNCTION public.validar_catalogo_configuracao_protocolo()',
    );

    expect(schemaPosition).toBeGreaterThan(-1);
    expect(schemaPosition).toBeLessThan(functionPosition);
    expect(migrationSql).toContain('ALTER COLUMN id SET DEFAULT gen_random_uuid()::text');
    expect(migrationSql).toContain('(empresa_id, codigo)');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS orgao text');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS sistema boolean');
  });

  it('projeta competência, período e prazo em RPC tenant-scoped', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.get_protocolos_operacionais()');
    expect(migrationSql).toContain("timezone('America/Sao_Paulo', now())");
    expect(migrationSql).toContain(
      "v_cliente_criado_em AT TIME ZONE 'America/Sao_Paulo'",
    );
    expect(migrationSql).toContain(
      "cliente.created_at AT TIME ZONE 'America/Sao_Paulo'",
    );
    expect(migrationSql).not.toContain("date_trunc('month', v_cliente_criado_em)");
    expect(migrationSql).not.toContain("date_trunc('month', cliente.created_at)");
    expect(migrationSql).toContain('public.current_user_can_access_client_row');
    expect(migrationSql).toContain("'prazo', projetado.prazo::text");
  });

  it('valida catálogo, regime, periodicidade e janela antes de gravar', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.validar_catalogo_configuracao_protocolo()');
    expect(migrationSql).toContain('v_regime = ANY(tipo.regimes)');
    expect(migrationSql).toContain('Competência fora da janela operacional permitida.');
    expect(migrationSql).toContain('Período incompatível com a periodicidade configurada.');
    expect(migrationSql).toContain("jsonb_typeof(config_item.valor -> 'ativo')");
    expect(migrationSql).toContain("chave NOT IN ('entregaId', 'ativo', 'periodicidade')");
    expect(migrationSql).toContain("NOT IN ('mensal', 'quinzenal', 'trimestral', 'semestral')");
    expect(migrationSql).toContain('HAVING count(*) > 1');
  });

  it('mantém o frontend apenas como consumidor da projeção', () => {
    expect(serviceSource).toContain("supabase.rpc('get_protocolos_operacionais')");
    expect(serviceSource).not.toContain('const makePrazo');
    expect(serviceSource).not.toContain('const getCompetenciasForCompany');
    expect(serviceSource).not.toContain('Math.min');
  });
});
