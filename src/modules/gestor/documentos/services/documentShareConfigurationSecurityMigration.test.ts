import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260826023600_restringir_configuracao_compartilhamento.sql?raw';

describe('RLS da configuração de compartilhamento', () => {
  it('garante no schema as colunas usadas pela política operacional', () => {
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS tempo_padrao_minutos');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS prazos_exigem_senha');
    expect(migrationSql).toContain('BETWEEN 10 AND 4320');
  });

  it('remove a policy genérica e separa leitura de mutações administrativas', () => {
    expect(migrationSql).toContain('DROP POLICY IF EXISTS configuracoes_compartilhamento_policy');
    expect(migrationSql).toContain('FOR SELECT');
    expect(migrationSql).toContain('public.is_empresa_member(empresa_id)');
    expect(migrationSql).toContain('FOR INSERT');
    expect(migrationSql).toContain('FOR UPDATE');
    expect(migrationSql).toContain('FOR DELETE');
    expect(migrationSql).not.toContain('FOR ALL');
  });

  it('exige apenas permissões administrativas válidas para toda escrita', () => {
    const mutationSection = migrationSql.slice(migrationSql.indexOf('FOR INSERT'));
    const configuracoesChecks = mutationSection.match(/'configuracoes:manage'/g) || [];
    const documentosChecks = mutationSection.match(/'documentos:manage'/g) || [];

    expect(configuracoesChecks).toHaveLength(4);
    expect(documentosChecks).toHaveLength(4);
  });
});
