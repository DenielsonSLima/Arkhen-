-- Mantem o onboarding historico para contas de email, mas impede que uma conta
-- Auth criada como funcionario CPF (inclusive um orfao de compensacao) o use
-- para criar empresa e membership administrativa.
ALTER FUNCTION public.finalizar_cadastro_auth(jsonb)
  RENAME TO _finalizar_cadastro_auth_email_interno;

REVOKE ALL ON FUNCTION public._finalizar_cadastro_auth_email_interno(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.finalizar_cadastro_auth(
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_login_method text;
  v_account_type text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Usuario nao autenticado.';
  END IF;

  SELECT
    auth_user.raw_app_meta_data->>'login_method',
    auth_user.raw_app_meta_data->>'account_type'
  INTO v_login_method, v_account_type
  FROM auth.users auth_user
  WHERE auth_user.id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Usuario nao autenticado.';
  END IF;

  IF v_login_method = 'cpf' OR v_account_type = 'employee_cpf' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501', MESSAGE = 'Funcionario CPF ja e provisionado pelo gestor.';
  END IF;

  RETURN public._finalizar_cadastro_auth_email_interno(p_payload);
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_cadastro_auth(jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_cadastro_auth(jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.finalizar_cadastro_auth(jsonb) IS
  'Onboarding exclusivo de contas tradicionais; funcionarios CPF sao provisionados pelo gestor.';
