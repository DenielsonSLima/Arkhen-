import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
  process.cwd(),
  'supabase/migrations/20260927141508_catalogo_rotinas_contabeis_por_empresa.sql',
), 'utf8');

describe('catálogo e rotinas contábeis por empresa', () => {
  it('delimita o tenant e serializa alterações de parametrização', () => {
    expect(migration).toContain("normalizar_cnpj_alfanumerico(empresa.cnpj) = '35898750000107'");
    expect(migration).toContain('pg_advisory_xact_lock(hashtextextended');
    expect(migration).toContain('SELECT empresa.id INTO STRICT v_empresa_id');
  });

  it('provisiona os 12 itens globais sem inventar vencimentos', () => {
    const codigos = [
      'caixa-postal-rfb', 'caixa-postal-sefaz', 'nfs', 'dirbi', 'mit',
      'pis-cofins', 'iss-iss-retido', 'fecoep-saidas', 'fecoep-entradas',
      'icms-difal', 'icms-normal', 'icms-antecipado',
    ];
    codigos.forEach((codigo) => expect(migration).toContain(`'${codigo}'`));
    expect(migration).toContain('padrao.tem_vencimento, true, 15, 30, padrao.ordem');
    expect(migration).toContain("'mit','MIT','Obrigações Acessórias','Receita Federal',25");
    expect(migration).toContain('parametrizacao_prazos_entrega AS prazo');
  });

  it('preserva escolhas inativas e restringe a ativação à COOPSEA', () => {
    expect(migration).toContain('CREATE TEMP TABLE _configs_inativos_antes');
    expect(migration).toContain('Uma obrigação antes inativa foi reativada.');
    expect(migration).toContain('Rotina nova ativada fora da COOPSEA.');
    const codigosCoopsea = new Set(
      (migration.match(/'coopsea-[^']+'/g) || [])
        .map((codigo) => codigo.slice(1, -1))
        .filter((codigo) => codigo !== 'coopsea-%'),
    );
    expect(codigosCoopsea).toHaveLength(39);
  });

  it('corrige os três regimes com CNPJ e nome no mesmo tenant', () => {
    expect(migration).toContain("'28354599000180','AMANI COSMETICS','Lucro Real'");
    expect(migration).toContain("'50343192000107','TAVARES DISTRIBUIDORA DE OVOS','Lucro Real'");
    expect(migration).toContain("'66876136000178','KARIB AUTO POSTO','Lucro Presumido'");
  });

  it('mantém helpers privados e classifica as rotinas operacionais', () => {
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain("'Obrigações Acessórias') THEN 'Fiscal'");
    expect(migration).toContain("'Departamento Pessoal') THEN 'Folha'");
    expect(migration).toContain('zz_classificar_rotina_obrigacao');
  });
});
