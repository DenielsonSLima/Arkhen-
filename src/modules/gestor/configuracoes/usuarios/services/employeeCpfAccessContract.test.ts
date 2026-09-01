import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readWorkspaceFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const schemaMigration = readWorkspaceFile(
  'supabase/migrations/20260901110711_acesso_funcionario_cpf.sql',
);
const securityMigration = readWorkspaceFile(
  'supabase/migrations/20260901112216_acesso_funcionario_cpf_seguranca.sql',
);
const contextMigration = readWorkspaceFile(
  'supabase/migrations/20260901113042_acesso_funcionario_cpf_contexto.sql',
);
const provisioningMigration = readWorkspaceFile(
  'supabase/migrations/20260901113048_acesso_funcionario_cpf_provisionamento.sql',
);
const policiesMigration = readWorkspaceFile(
  'supabase/migrations/20260901113055_acesso_funcionario_cpf_policies.sql',
);
const onboardingGuardMigration = readWorkspaceFile(
  'supabase/migrations/20260901115208_acesso_funcionario_cpf_onboarding_guard.sql',
);
const statusSyncMigration = readWorkspaceFile(
  'supabase/migrations/20260901115352_acesso_funcionario_cpf_sincronizacao_status.sql',
);
const passwordResetMigration = readWorkspaceFile(
  'supabase/migrations/20260901120631_acesso_funcionario_cpf_reset_senha.sql',
);
const edgeFunction = readWorkspaceFile('supabase/functions/manage-employee-user/index.ts');
const edgeRuntime = readWorkspaceFile('supabase/functions/manage-employee-user/runtime.ts');

describe('contrato de acesso do funcionário por CPF', () => {
  it('isola a identidade técnica em schema privado sem alterar a cardinalidade Auth legada', () => {
    expect(schemaMigration).toMatch(
      /CREATE TABLE IF NOT EXISTS private\.segredos_autenticacao/,
    );
    expect(schemaMigration).toContain("extensions.gen_random_bytes(32)");
    expect(schemaMigration).toContain('REVOKE ALL ON TABLE private.segredos_autenticacao');
    expect(schemaMigration).toMatch(
      /CREATE TABLE IF NOT EXISTS private\.identidades_funcionarios_cpf/,
    );
    expect(schemaMigration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS identidades_funcionarios_cpf_cpf_normalizado_unq/,
    );
    expect(schemaMigration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS identidades_funcionarios_cpf_auth_user_unq/,
    );
    expect(schemaMigration).toContain('REVOKE ALL ON TABLE private.identidades_funcionarios_cpf');
    expect(schemaMigration).toMatch(/DROP COLUMN IF EXISTS auth_alias,[\s\S]*cpf_normalizado/);
    expect(schemaMigration).not.toContain('configuracoes_usuarios_auth_user_global_unq');
  });

  it('centraliza status, janela, tenant e perfil operacional no banco', () => {
    expect(securityMigration).toContain('current_user_access_allowed');
    expect(securityMigration).toContain('configuracao_acesso_permite_agora');
    expect(securityMigration).toContain("membership.papel IN ('admin', 'contador', 'assistente', 'membro')");
    expect(securityMigration).toContain("v_auth_account_type IS DISTINCT FROM 'employee_cpf'");
  });

  it('não publica o alias técnico no contexto de autorização da aplicação', () => {
    const returnedContext = contextMigration.split('RETURN pg_catalog.jsonb_build_object(')[1] || '';
    expect(returnedContext).toContain("'perfil_acesso_id'");
    expect(returnedContext).toContain("'membership_papel'");
    expect(returnedContext).not.toContain("'auth_alias'");
  });

  it('reserva provisionamento e trocas de senha CPF ao service role', () => {
    expect(provisioningMigration).toContain('resolver_alias_autenticacao_funcionario_cpf');
    expect(provisioningMigration).toContain("extensions.hmac(");
    expect(provisioningMigration).toContain('preparar_provisionamento_funcionario_cpf');
    expect(provisioningMigration).toContain("v_perfil_nome,\n    v_status");
    expect(provisioningMigration).toContain("'membro'");
    expect(provisioningMigration).toContain('TO service_role');
    expect(provisioningMigration).toContain('FROM PUBLIC, anon, authenticated');
    expect(passwordResetMigration).toContain('preparar_reset_senha_funcionario_cpf');
    expect(passwordResetMigration).toContain(
      'preparar_alteracao_senha_propria_funcionario_cpf',
    );
    expect(passwordResetMigration).toContain('FROM PUBLIC, anon, authenticated');
    expect(passwordResetMigration).toContain('TO service_role');
  });

  it('endurece apenas as policies de identidade sem reescrever outros módulos', () => {
    expect(policiesMigration).toContain('perfis_select_self_or_manager');
    expect(policiesMigration).toContain('configuracoes_usuarios_select_self_or_manager');
    expect(policiesMigration).toContain('current_user_access_allowed');
    expect(policiesMigration).toContain("login_method = 'email'");
    expect(policiesMigration).toContain('proteger_perfil_acesso_funcionario_cpf_trigger');
    expect(policiesMigration).not.toContain('storage.objects');
    expect(policiesMigration).not.toContain('agenda_eventos');
    expect(policiesMigration).not.toContain('FOR v_policy IN');
  });

  it('sincroniza status do cadastro com a membership operacional', () => {
    expect(statusSyncMigration).toContain('sincronizar_status_membership_usuario');
    expect(statusSyncMigration).toContain("SET ativo = (NEW.status = 'Ativo')");
    expect(statusSyncMigration).toContain('AFTER INSERT OR UPDATE OF status');
  });

  it('impede que uma conta Auth CPF órfã use o onboarding de gestor', () => {
    expect(onboardingGuardMigration).toContain('_finalizar_cadastro_auth_email_interno');
    expect(onboardingGuardMigration).toContain("v_login_method = 'cpf'");
    expect(onboardingGuardMigration).toContain("v_account_type = 'employee_cpf'");
    expect(onboardingGuardMigration).toContain('FROM PUBLIC, anon, service_role');
  });

  it('autentica dentro da Edge, valida o contexto e não devolve alias no JSON de login', () => {
    expect(edgeFunction).toContain("payload.action === 'login'");
    expect(edgeFunction).toContain("client.auth.signInWithPassword");
    expect(edgeFunction).toContain("client.rpc('obter_contexto_usuario_atual')");
    expect(edgeFunction).toContain('access_token: data.session.access_token');
    expect(edgeFunction).toContain("new HttpError(409, 'Não foi possível criar o funcionário.')");
    expect(edgeFunction).not.toContain("payload.action === 'resolve_login'");
    expect(edgeFunction).not.toMatch(/jsonResponse\(\{[^}]*alias/s);
  });

  it('atribui o rate limit de login ao IP encaminhado pelo gateway oficial', () => {
    expect(edgeRuntime).toContain("requireEnvironment('SUPABASE_SECRET_KEYS')");
    expect(edgeRuntime).toContain("'sb-forwarded-for': forwardedFor");
    expect(edgeRuntime).not.toContain("requireEnvironment('SUPABASE_ANON_KEY')");
  });

});
