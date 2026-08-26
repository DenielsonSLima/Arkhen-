-- Torna atomicas as alteracoes de cadastro, membership e papel de usuarios.
-- SECURITY INVOKER preserva integralmente grants, triggers e RLS do chamador.
BEGIN;

CREATE OR REPLACE FUNCTION public.salvar_usuario_configurado(
  p_usuario_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_target public.configuracoes_usuarios%ROWTYPE;
  v_membership public.perfis%ROWTYPE;
  v_result public.configuracoes_usuarios%ROWTYPE;
  v_payload_keys text[];
  v_access_keys text[];
  v_status_only boolean := false;
  v_membership_found boolean := false;
  v_membership_id uuid;
  v_profile_code text;
  v_membership_role text;
  v_nome text;
  v_email text;
  v_cpf text;
  v_telefone text;
  v_perfil text;
  v_status text;
  v_access_config jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Sessao autenticada e empresa ativa obrigatorias.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_is_empresa_admin(v_empresa_id) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar usuarios e perfis.'
      USING ERRCODE = '42501';
  END IF;

  IF p_usuario_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Cadastro e dados do usuario sao obrigatorios.'
      USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(payload_key ORDER BY payload_key)
    INTO v_payload_keys
  FROM jsonb_object_keys(p_payload) payload_keys(payload_key);

  v_status_only := v_payload_keys = ARRAY['status']::text[]
    AND p_payload ->> 'status' = 'Inativo';

  IF NOT v_status_only AND v_payload_keys IS DISTINCT FROM ARRAY[
    'accessConfig', 'cpf', 'email', 'nome', 'perfil', 'status', 'telefone'
  ]::text[] THEN
    RAISE EXCEPTION 'O payload de usuario possui campos ausentes ou nao permitidos.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('admin-access:' || v_empresa_id::text, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('salvar-usuario:' || v_empresa_id::text || ':' || p_usuario_id::text, 0)
  );

  SELECT *
    INTO v_target
  FROM public.configuracoes_usuarios target
  WHERE target.id = p_usuario_id
    AND target.empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario nao encontrado nesta empresa.' USING ERRCODE = 'P0002';
  END IF;

  IF v_status_only THEN
    v_nome := v_target.nome;
    v_email := lower(btrim(v_target.email));
    v_cpf := v_target.cpf;
    v_telefone := v_target.telefone;
    v_perfil := v_target.perfil;
    v_status := 'Inativo';
    v_access_config := v_target.access_config;
  ELSE
    v_nome := btrim(COALESCE(p_payload ->> 'nome', ''));
    v_email := lower(btrim(COALESCE(p_payload ->> 'email', '')));
    v_cpf := NULLIF(btrim(COALESCE(p_payload ->> 'cpf', '')), '');
    v_telefone := NULLIF(btrim(COALESCE(p_payload ->> 'telefone', '')), '');
    v_perfil := btrim(COALESCE(p_payload ->> 'perfil', ''));
    v_status := COALESCE(p_payload ->> 'status', '');
    v_access_config := p_payload -> 'accessConfig';

    IF v_nome = '' OR char_length(v_nome) > 150 THEN
      RAISE EXCEPTION 'Informe um nome com ate 150 caracteres.' USING ERRCODE = '22023';
    END IF;
    IF v_email = '' OR char_length(v_email) > 150
       OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'Informe um e-mail valido com ate 150 caracteres.'
        USING ERRCODE = '22023';
    END IF;
    IF char_length(COALESCE(v_cpf, '')) > 20
       OR char_length(COALESCE(v_telefone, '')) > 30 THEN
      RAISE EXCEPTION 'CPF ou telefone excede o tamanho permitido.' USING ERRCODE = '22023';
    END IF;
    IF v_perfil = '' OR char_length(v_perfil) > 80 THEN
      RAISE EXCEPTION 'Selecione um perfil de acesso valido.' USING ERRCODE = '22023';
    END IF;
    IF v_status NOT IN ('Ativo', 'Inativo', 'Pendente') THEN
      RAISE EXCEPTION 'Status de usuario invalido.' USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(v_access_config) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Configuracao de acesso invalida.' USING ERRCODE = '22023';
    END IF;

    SELECT array_agg(access_key ORDER BY access_key)
      INTO v_access_keys
    FROM jsonb_object_keys(v_access_config) access_keys(access_key);

    IF v_access_keys IS DISTINCT FROM ARRAY[
      'days', 'enabled', 'intervals', 'message'
    ]::text[]
       OR jsonb_typeof(v_access_config -> 'enabled') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(v_access_config -> 'days') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_access_config -> 'intervals') IS DISTINCT FROM 'array'
       OR jsonb_typeof(v_access_config -> 'message') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Configuracao de acesso incompleta ou invalida.'
        USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(v_access_config -> 'days') NOT BETWEEN 1 AND 7
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(v_access_config -> 'days') day_item(value)
         WHERE jsonb_typeof(day_item.value) <> 'number'
           OR day_item.value::text !~ '^[0-6]$'
       )
       OR (
         SELECT count(*) <> count(DISTINCT day_item.value::text)
         FROM jsonb_array_elements(v_access_config -> 'days') day_item(value)
       ) THEN
      RAISE EXCEPTION 'Dias da janela de acesso invalidos.' USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(v_access_config -> 'intervals') NOT BETWEEN 1 AND 4
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements(v_access_config -> 'intervals') interval_item(value)
         WHERE jsonb_typeof(interval_item.value) <> 'object'
       ) THEN
      RAISE EXCEPTION 'Intervalos da janela de acesso invalidos.' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_access_config -> 'intervals') interval_item(value)
      WHERE (
          SELECT array_agg(interval_key ORDER BY interval_key)
          FROM jsonb_object_keys(interval_item.value) interval_keys(interval_key)
        ) IS DISTINCT FROM ARRAY['end', 'start']::text[]
        OR jsonb_typeof(interval_item.value -> 'start') IS DISTINCT FROM 'string'
        OR jsonb_typeof(interval_item.value -> 'end') IS DISTINCT FROM 'string'
        OR COALESCE(interval_item.value ->> 'start', '')
          !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR COALESCE(interval_item.value ->> 'end', '')
          !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR COALESCE(interval_item.value ->> 'start', '')
          >= COALESCE(interval_item.value ->> 'end', '')
    ) THEN
      RAISE EXCEPTION 'Horarios da janela de acesso invalidos.' USING ERRCODE = '22023';
    END IF;

    IF char_length(COALESCE(v_access_config ->> 'message', '')) > 240 THEN
      RAISE EXCEPTION 'Mensagem da janela de acesso excede 240 caracteres.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_target.auth_user_id IS NOT NULL
     AND v_email IS DISTINCT FROM lower(btrim(v_target.email)) THEN
    RAISE EXCEPTION 'O e-mail de uma conta vinculada nao pode ser alterado.'
      USING ERRCODE = '23514';
  END IF;

  IF v_target.auth_user_id = auth.uid()
     AND (v_status <> 'Ativo' OR v_perfil IS DISTINCT FROM v_target.perfil) THEN
    RAISE EXCEPTION 'Voce nao pode alterar o proprio perfil ou inativar o proprio acesso.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_status_only OR v_status = 'Ativo' THEN
    SELECT lower(btrim(profile.codigo))
      INTO v_profile_code
    FROM public.configuracoes_perfis_acesso profile
    WHERE profile.empresa_id = v_empresa_id
      AND profile.nome = v_perfil
      AND profile.ativo = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selecione um perfil de acesso ativo desta empresa.'
        USING ERRCODE = '23503';
    END IF;
  END IF;

  v_membership_role := CASE
    WHEN v_profile_code IN ('administrador', 'gestor') THEN 'admin'
    ELSE 'membro'
  END;

  IF v_target.auth_user_id IS NOT NULL THEN
    SELECT *
      INTO v_membership
    FROM public.perfis membership
    WHERE membership.empresa_id = v_empresa_id
      AND membership.user_id = v_target.auth_user_id
    FOR UPDATE;
    v_membership_found := FOUND;

    IF v_status = 'Ativo' THEN
      IF v_membership_found THEN
        UPDATE public.perfis
        SET nome = v_nome,
            papel = v_membership_role,
            ativo = true,
            updated_at = now()
        WHERE id = v_membership.id
        RETURNING id INTO v_membership_id;
      ELSE
        INSERT INTO public.perfis (empresa_id, user_id, nome, papel, ativo)
        VALUES (
          v_empresa_id,
          v_target.auth_user_id,
          v_nome,
          v_membership_role,
          true
        )
        RETURNING id INTO v_membership_id;
      END IF;
    ELSIF v_membership_found THEN
      UPDATE public.perfis
      SET nome = v_nome,
          ativo = false,
          updated_at = now()
      WHERE id = v_membership.id
      RETURNING id INTO v_membership_id;
    END IF;
  ELSIF v_status = 'Ativo' THEN
    RAISE EXCEPTION 'Conclua o convite antes de ativar este usuario.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.configuracoes_usuarios
  SET perfil_id = COALESCE(v_membership_id, v_target.perfil_id),
      nome = v_nome,
      email = v_email,
      cpf = v_cpf,
      telefone = v_telefone,
      perfil = v_perfil,
      status = v_status,
      access_config = v_access_config,
      updated_at = now()
  WHERE id = v_target.id
    AND empresa_id = v_empresa_id
  RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'id', v_result.id,
    'auth_user_id', v_result.auth_user_id,
    'perfil_id', v_result.perfil_id,
    'nome', v_result.nome,
    'email', v_result.email,
    'cpf', v_result.cpf,
    'telefone', v_result.telefone,
    'perfil', v_result.perfil,
    'status', v_result.status,
    'access_config', v_result.access_config,
    'ultimo_acesso_em', v_result.ultimo_acesso_em,
    'created_at', v_result.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_usuario_configurado(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salvar_usuario_configurado(uuid, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.serializar_alteracao_acesso_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := OLD.empresa_id;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('admin-access:' || v_empresa_id::text, 0)
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.serializar_alteracao_acesso_empresa()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS a_serializar_alteracao_acesso_empresa
  ON public.perfis;
CREATE TRIGGER a_serializar_alteracao_acesso_empresa
  BEFORE UPDATE OR DELETE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.serializar_alteracao_acesso_empresa();

DROP TRIGGER IF EXISTS a_serializar_alteracao_acesso_empresa
  ON public.configuracoes_usuarios;
CREATE TRIGGER a_serializar_alteracao_acesso_empresa
  BEFORE UPDATE OR DELETE ON public.configuracoes_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.serializar_alteracao_acesso_empresa();

CREATE OR REPLACE FUNCTION public.proteger_admin_utilizavel_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF OLD.papel = 'admin'
     AND OLD.ativo = true
     AND EXISTS (
       SELECT 1
       FROM public.configuracoes_usuarios target_user
       WHERE target_user.empresa_id = OLD.empresa_id
         AND target_user.auth_user_id = OLD.user_id
         AND target_user.status = 'Ativo'
         AND lower(COALESCE(target_user.access_config ->> 'enabled', 'false')) <> 'true'
     )
     AND (
       TG_OP = 'DELETE'
       OR NEW.papel <> 'admin'
       OR NEW.ativo = false
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.perfis other_membership
       JOIN public.configuracoes_usuarios other_user
         ON other_user.empresa_id = other_membership.empresa_id
        AND other_user.auth_user_id = other_membership.user_id
        AND other_user.status = 'Ativo'
        AND lower(COALESCE(other_user.access_config ->> 'enabled', 'false')) <> 'true'
       WHERE other_membership.empresa_id = OLD.empresa_id
         AND other_membership.id <> OLD.id
         AND other_membership.papel = 'admin'
         AND other_membership.ativo = true
     ) THEN
    RAISE EXCEPTION 'A empresa deve manter ao menos um administrador ativo e sem janela de acesso.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_admin_utilizavel_membership()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS b_proteger_admin_utilizavel_membership
  ON public.perfis;
CREATE TRIGGER b_proteger_admin_utilizavel_membership
  BEFORE UPDATE OR DELETE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.proteger_admin_utilizavel_membership();

COMMIT;
