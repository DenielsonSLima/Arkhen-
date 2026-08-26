import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../supabase/migrations/20260826025800_resumo_inicio_operacional_rpc.sql?raw';
import pageSource from '../InicioPage.tsx?raw';
import serviceSource from './inicioService.ts?raw';
import summarySource from './inicioDashboardSummary.ts?raw';

describe('resumo operacional do Início no servidor', () => {
  it('expõe uma única RPC invoker protegida pelo tenant e pelas RLS', () => {
    expect(migrationSql).toContain('public.obter_resumo_inicio()');
    expect(migrationSql).toContain('SECURITY INVOKER');
    expect(migrationSql).toContain("SET search_path = ''");
    expect(migrationSql).toContain('SET row_security = on');
    expect(migrationSql).toContain('public.current_empresa_id()');
    expect(migrationSql).toContain('public.current_user_access_allowed(v_empresa_id)');
    expect(migrationSql).toContain('public.current_user_can_access_client_row');
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.obter_resumo_inicio() TO authenticated');
    expect(migrationSql).toContain('REVOKE ALL ON FUNCTION public.obter_resumo_inicio()');
  });

  it('calcula tarefas, agenda, alertas e produtividade no PostgreSQL', () => {
    expect(migrationSql).toContain("AT TIME ZONE 'America/Sao_Paulo'");
    expect(migrationSql).toContain("'tarefas', jsonb_build_object(");
    expect(migrationSql).toContain("'agenda', jsonb_build_object(");
    expect(migrationSql).toContain("'alertas', jsonb_build_object(");
    expect(migrationSql).toContain("'operacao', jsonb_build_object(");
    expect(migrationSql).toContain("'usuarios', usuarios_json.itens");
    expect(migrationSql).toContain('round(metrica.concluidas * 100.0 / metrica.total)');
    expect(migrationSql).toContain("tarefa.frequencia IN ('Semanal', 'Quinzenal')");
  });

  it('fixa o fuso da origem antes de converter ocorrências padrão', () => {
    const timezoneFix = migrationSql.indexOf(
      'ALTER FUNCTION public.listar_agenda_padroes_ocorrencias(integer, integer, integer)',
    );
    const summaryFunction = migrationSql.indexOf(
      'CREATE OR REPLACE FUNCTION public.obter_resumo_inicio()',
    );

    expect(timezoneFix).toBeGreaterThan(-1);
    expect(timezoneFix).toBeLessThan(summaryFunction);
    expect(migrationSql).toContain("SET timezone TO 'America/Sao_Paulo'");
    expect(migrationSql).toContain("padrao.data_inicio AT TIME ZONE 'America/Sao_Paulo'");
  });

  it('preserva vencimentos reais e rejeita datas inválidas de certificados', () => {
    expect(migrationSql).toContain('FROM public.documentos documento');
    expect(migrationSql).toContain("jsonb_typeof(cliente.certificados) = 'array'");
    expect(migrationSql).toContain("certificado.item ->> 'dataValidade'");
    expect(migrationSql).toContain("~ '^(19|20|21)[0-9]{2}-");
    expect(migrationSql).toContain("to_char(certificado.data_validade, 'YYYY-MM-DD')");
    expect(migrationSql).toContain("documento.data_validade <= v_hoje + 15");
    expect(migrationSql).not.toMatch(/demo|demonstra[cç][aã]o/i);
  });

  it('mantém os totais completos sem deixar o payload de alertas crescer sem limite', () => {
    expect(migrationSql).toContain('FROM totais CROSS JOIN totais_alertas');
    expect(migrationSql).toMatch(/SELECT \* FROM alertas\s+ORDER BY dias_restantes, id\s+LIMIT 50/);
  });

  it('deixa o frontend somente com tipos, busca e apresentação', () => {
    expect(serviceSource).toContain("supabase.rpc('obter_resumo_inicio')");
    expect(serviceSource).not.toContain(".from('");
    expect(summarySource).not.toContain('buildInicioDashboardSummary');
    expect(summarySource).not.toContain('Math.round');
    expect(pageSource).not.toContain('buildInicioDashboardSummary');
    expect(pageSource).not.toContain('tarefasWorkspace');
    expect(pageSource).not.toContain('eventosAgenda');
  });
});
