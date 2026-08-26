import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260826025700_corrigir_regime_padrao_e_cache_legado.sql?raw';
import storageSource from '../../../../lib/persistedStorage.ts?raw';
import inicioSource from '../../inicio/services/inicioService.ts?raw';

describe('regime não informado e remoção do cache legado', () => {
  it('define o default do banco como Não informado', () => {
    expect(migrationSql).toContain("ALTER COLUMN tipo SET DEFAULT 'Não informado'");
  });

  it('remove e bloqueia a antiga segunda fonte de clientes', () => {
    expect(migrationSql).toContain("WHERE chave = 'contabil_gestao_empresarial_companies'");
    expect(storageSource).toContain('DISCARDED_LEGACY_KEYS');
    expect(inicioSource).not.toContain('contabil_gestao_empresarial_companies');
    expect(inicioSource).not.toContain('persistedStorage');
  });
});
