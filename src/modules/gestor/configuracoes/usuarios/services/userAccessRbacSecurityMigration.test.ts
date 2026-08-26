import { describe, expect, it } from 'vitest';
import migrationSql from '../../../../../../supabase/migrations/20260826024600_endurecer_rbac_janelas_acesso.sql?raw';
import adminGuardSql from '../../../../../../supabase/migrations/20260826025200_proteger_administradores_e_retorno_solicitacoes.sql?raw';
import inviteSource from '../../../../../../supabase/functions/invite-accounting-user/index.ts?raw';

describe('RBAC e janela de acesso no servidor', () => {
  it('faz a membership depender de usuário ativo e da janela de acesso', () => {
    expect(migrationSql).toContain('current_user_access_allowed');
    expect(migrationSql).toContain("u.status = 'Ativo'");
    expect(migrationSql).toContain("u.access_config ->> 'enabled'");
    expect(migrationSql).toContain("AT TIME ZONE 'America/Sao_Paulo'");
    expect(migrationSql).toContain('SELECT public.current_user_access_allowed(p_empresa_id)');
  });

  it('amarra a configuração à mesma membership, empresa e conta Auth', () => {
    expect(migrationSql).toContain('FOREIGN KEY (perfil_id, empresa_id, auth_user_id)');
    expect(migrationSql).toContain('REFERENCES public.perfis (id, empresa_id, user_id)');
    expect(migrationSql).toContain('configuracoes_usuarios_empresa_auth_unique');
  });

  it('reserva concessão de perfis e memberships ao administrador', () => {
    expect(migrationSql).toContain('current_user_is_empresa_admin');
    expect(migrationSql).toContain('Somente administradores podem conceder perfis de acesso');
    expect(migrationSql).toContain('configuracoes_perfis_acesso_update_admin');
    expect(migrationSql).toContain('A empresa deve manter ao menos um administrador ativo');
    expect(inviteSource).toContain('current_user_is_empresa_admin');
    expect(inviteSource).not.toContain('p_permission: "usuarios:manage"');
    expect(inviteSource).toContain('.select("id,nome,codigo")');
    expect(inviteSource).toContain('membershipRoleForProfileCode(profile.codigo)');
    expect(inviteSource).toContain('papel: membershipRole');
  });

  it('preserva o onboarding próprio sem abrir criação direta de terceiros', () => {
    expect(migrationSql).toContain('NEW.user_id IS DISTINCT FROM auth.uid()');
    expect(migrationSql).toContain('v_self_onboarding := (');
    expect(migrationSql).toContain("TG_OP = 'INSERT'");
    expect(migrationSql).toContain('NEW.auth_user_id = auth.uid()');
    expect(migrationSql).toContain('OLD.auth_user_id = auth.uid()');
    expect(migrationSql).toContain('NEW.access_config IS NOT DISTINCT FROM OLD.access_config');
    expect(migrationSql).toContain('perfis_insert_admin');
  });

  it('impede que usuarios:manage altere ou exclua administradores', () => {
    expect(adminGuardSql).toContain('public.proteger_administrador_configurado()');
    expect(adminGuardSql).toContain("membership.papel = 'admin'");
    expect(adminGuardSql).toContain('public.current_user_is_empresa_admin(v_empresa_id)');
    expect(adminGuardSql).toContain(
      'Somente administradores podem alterar ou excluir outro administrador.',
    );
    expect(adminGuardSql).toContain('BEFORE UPDATE OR DELETE ON public.configuracoes_usuarios');
  });

  it('mantém ao menos um administrador configurado, vinculado e ativo', () => {
    expect(adminGuardSql).toContain("other_membership.papel = 'admin'");
    expect(adminGuardSql).toContain('other_membership.ativo = true');
    expect(adminGuardSql).toContain("other_user.status = 'Ativo'");
    expect(adminGuardSql).toContain('other_user.id <> OLD.id');
    expect(adminGuardSql).toContain(
      'A empresa deve manter ao menos um administrador configurado, ativo e sem janela de acesso.',
    );
    expect(adminGuardSql).toContain("IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;");
  });

  it('não permite restringir por horário o único administrador ativo', () => {
    expect(adminGuardSql).toContain('v_has_other_unrestricted_admin boolean := false');
    expect(adminGuardSql).toContain("NEW.access_config ->> 'enabled'");
    expect(adminGuardSql).toContain("other_user.access_config ->> 'enabled'");
    expect(adminGuardSql).toContain('AND NOT v_has_other_unrestricted_admin');
    expect(adminGuardSql).toContain(
      'O único administrador ativo não pode ter janela de acesso restrita.',
    );
  });
});
