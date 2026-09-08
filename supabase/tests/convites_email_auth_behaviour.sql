-- Somente banco isolado criado pelo run-convites-email.mjs.
CREATE FUNCTION test_convite_payload() RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'nome','Pessoa de Teste','email','convite@example.com','cpf','52998224725',
    'telefone','7900000000','perfil_id','30000000-0000-4000-8000-000000000001',
    'credential_version','50000000-0000-4000-8000-000000000001',
    'access_config','{"enabled":false}'::jsonb
  )
$$;

CREATE FUNCTION test_criar_conta_auth() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.configuracoes_eventos_logs;
  DELETE FROM public.configuracoes_usuarios
    WHERE auth_user_id = '40000000-0000-4000-8000-000000000001';
  DELETE FROM public.perfis WHERE user_id = '40000000-0000-4000-8000-000000000001';
  DELETE FROM auth.users WHERE id = '40000000-0000-4000-8000-000000000001';
  -- Auth adminUserCreate insere provider/providers primeiro. O app_metadata
  -- administrativo so chega em UPDATE posterior, na mesma transacao do Auth.
  INSERT INTO auth.users (id,email,raw_app_meta_data,raw_user_meta_data)
  VALUES ('40000000-0000-4000-8000-000000000001','convite@example.com',
    '{"provider":"email","providers":["email"]}', '{"nome":"Pessoa de Teste"}');
  UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data ||
    '{"account_type":"employee_email","login_method":"email","credential_version":"50000000-0000-4000-8000-000000000001"}'::jsonb
  WHERE id = '40000000-0000-4000-8000-000000000001';
END;
$$;

CREATE FUNCTION test_reproduzir_auto_confirm_legado() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM test_criar_conta_auth();
  IF NOT EXISTS (SELECT 1 FROM auth.users
    WHERE id = '40000000-0000-4000-8000-000000000001' AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Fixture nao reproduziu a confirmacao indevida no INSERT.';
  END IF;
  BEGIN
    PERFORM public.provisionar_usuario_funcionario_email(
      '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
      test_convite_payload()
    );
    RAISE EXCEPTION 'Guard deveria recusar a conta confirmada pelo trigger legado.';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'Conta Auth nao corresponde ao convite.' THEN RAISE; END IF;
  END;
END;
$$;

CREATE FUNCTION test_convites_email_apos_correcao() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_resultado jsonb;
  v_caso text;
  v_actor uuid;
  v_payload jsonb;
BEGIN
  PERFORM test_criar_conta_auth();
  IF EXISTS (SELECT 1 FROM auth.users
    WHERE id = '40000000-0000-4000-8000-000000000001' AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Conta de convite deve continuar sem confirmacao apos INSERT e UPDATE.';
  END IF;
  v_resultado := public.provisionar_usuario_funcionario_email(
    '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
    test_convite_payload()
  );
  IF v_resultado->>'status' <> 'Pendente'
    OR v_resultado->>'perfil' <> 'Administrador'
    OR v_resultado->>'membership_papel' <> 'membro'
    OR (v_resultado->>'must_change_password')::boolean IS DISTINCT FROM true
    OR NOT EXISTS (SELECT 1 FROM public.perfis
      WHERE id = (v_resultado->>'membership_id')::uuid AND ativo = false) THEN
    RAISE EXCEPTION 'Provisionamento deve manter convite pendente e membership desativado.';
  END IF;

  FOREACH v_caso IN ARRAY ARRAY[
    'email_confirmado','convite_enviado','email_divergente','metadata_divergente',
    'versao_divergente','metadata_usuario_forjada','ator_sem_empresa',
    'ator_sem_permissao','perfil_outro_tenant'
  ] LOOP
    PERFORM test_criar_conta_auth();
    v_actor := '20000000-0000-4000-8000-000000000001';
    v_payload := test_convite_payload();
    CASE v_caso
      WHEN 'email_confirmado' THEN
        UPDATE auth.users SET email_confirmed_at = now()
        WHERE id = '40000000-0000-4000-8000-000000000001';
      WHEN 'convite_enviado' THEN
        UPDATE auth.users SET invited_at = now()
        WHERE id = '40000000-0000-4000-8000-000000000001';
      WHEN 'email_divergente' THEN
        UPDATE auth.users SET email = 'outra-conta@example.com'
        WHERE id = '40000000-0000-4000-8000-000000000001';
      WHEN 'metadata_divergente' THEN
        UPDATE auth.users SET raw_app_meta_data = '{}'
        WHERE id = '40000000-0000-4000-8000-000000000001';
      WHEN 'versao_divergente' THEN
        UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data ||
          '{"credential_version":"50000000-0000-4000-8000-000000000002"}'::jsonb
        WHERE id = '40000000-0000-4000-8000-000000000001';
      WHEN 'metadata_usuario_forjada' THEN
        UPDATE auth.users SET raw_user_meta_data = raw_app_meta_data, raw_app_meta_data = '{}'
        WHERE id = '40000000-0000-4000-8000-000000000001';
      WHEN 'ator_sem_empresa' THEN
        v_actor := '20000000-0000-4000-8000-000000000099';
      WHEN 'ator_sem_permissao' THEN
        v_actor := '20000000-0000-4000-8000-000000000002';
      WHEN 'perfil_outro_tenant' THEN
        v_payload := v_payload || '{"perfil_id":"30000000-0000-4000-8000-000000000002"}'::jsonb;
    END CASE;
    BEGIN
      PERFORM public.provisionar_usuario_funcionario_email(
        v_actor,'40000000-0000-4000-8000-000000000001',v_payload
      );
      RAISE EXCEPTION 'Guard aceitou caso invalido: %', v_caso;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    IF EXISTS (SELECT 1 FROM public.perfis
      WHERE user_id = '40000000-0000-4000-8000-000000000001') THEN
      RAISE EXCEPTION 'Recusa deixou membership residual: %', v_caso;
    END IF;
  END LOOP;

  -- Signup segue confirmacao configurada no Auth; user_metadata nao confirma email.
  INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES
    ('40000000-0000-4000-8000-000000000002','cadastro@example.com',
      '{"email_confirm":true,"account_type":"employee_cpf"}');
  IF EXISTS (SELECT 1 FROM auth.users
    WHERE id = '40000000-0000-4000-8000-000000000002' AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Dados editaveis pelo usuario nao podem confirmar o email.';
  END IF;
  -- O Auth aplica email_confirm:true explicitamente em UPDATE, inclusive CPF.
  UPDATE auth.users SET email_confirmed_at = '2026-09-08T12:00:00Z'
    WHERE id = '40000000-0000-4000-8000-000000000002';
  IF NOT EXISTS (SELECT 1 FROM auth.users
    WHERE id = '40000000-0000-4000-8000-000000000002'
      AND email_confirmed_at = '2026-09-08T12:00:00Z') THEN
    RAISE EXCEPTION 'Confirmacao explicita do Auth deve ser preservada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users
    WHERE id = '20000000-0000-4000-8000-000000000001' AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'A migration nao deve alterar confirmacao de contas existentes.';
  END IF;
END;
$$;
