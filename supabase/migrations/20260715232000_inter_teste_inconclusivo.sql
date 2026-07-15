-- Falhas transitorias sem resposta do Inter nao devem classificar as
-- credenciais como invalidas. O ambiente permanece em validacao.
CREATE OR REPLACE FUNCTION public.registrar_inter_teste_conexao(
  p_user_id uuid,
  p_ambiente text,
  p_resultado jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.resolve_inter_manager_empresa_id(p_user_id);
  v_ambiente text := public.normalize_inter_environment(p_ambiente);
  v_ok boolean := public.inter_jsonb_boolean(p_resultado, 'ok', false);
  v_inconclusivo boolean := public.inter_jsonb_boolean(p_resultado, 'inconclusivo', false);
  v_erro text := CASE WHEN public.inter_jsonb_boolean(p_resultado, 'ok', false) THEN NULL
    ELSE left(coalesce(NULLIF(p_resultado->>'erro', ''), 'Falha ao validar a conexao.'), 1000) END;
  v_valid_from text := left(coalesce(NULLIF(p_resultado->>'certificateValidFrom', ''),
    NULLIF(p_resultado->>'certificadoValidoDe', '')), 64);
  v_valid_until text := left(coalesce(NULLIF(p_resultado->>'certificateValidUntil', ''),
    NULLIF(p_resultado->>'certificadoValidoAte', '')), 64);
  v_row public.configuracoes_integracao_bancaria;
  v_env jsonb;
  v_active text;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem permissao para configurar a integracao.';
  END IF;
  SELECT * INTO v_row
  FROM public.configuracoes_integracao_bancaria c
  WHERE c.empresa_id = v_empresa_id AND c.provedor = 'inter';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Integracao Banco Inter nao configurada.';
  END IF;

  v_active := public.normalize_inter_environment(v_row.configuracao->>'activeEnvironment');
  v_env := coalesce(v_row.configuracao->'environments'->v_ambiente, '{}'::jsonb);
  v_env := jsonb_set(
    jsonb_set(v_env, '{ultimoTesteOk}', to_jsonb(v_ok), true),
    '{ultimoTesteEm}',
    to_jsonb(now()),
    true
  );
  IF v_valid_from ~ '^\d{4}-\d{2}-\d{2}T' THEN
    v_env := jsonb_set(v_env, '{certificadoValidoDe}', to_jsonb(v_valid_from), true);
  END IF;
  IF v_valid_until ~ '^\d{4}-\d{2}-\d{2}T' THEN
    v_env := jsonb_set(v_env, '{certificadoValidoAte}', to_jsonb(v_valid_until), true);
  END IF;

  UPDATE public.configuracoes_integracao_bancaria c
  SET configuracao = jsonb_set(c.configuracao, ARRAY['environments', v_ambiente], v_env, true),
      status = CASE
        WHEN v_ambiente <> v_active THEN c.status
        WHEN v_inconclusivo THEN 'em_validacao'
        WHEN v_ok THEN 'ativo'
        ELSE 'erro'
      END,
      ultimo_erro = CASE WHEN v_ambiente <> v_active THEN c.ultimo_erro ELSE v_erro END,
      validado_em = CASE WHEN v_ambiente = v_active AND v_ok THEN now() ELSE c.validado_em END,
      updated_at = now()
  WHERE c.id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', v_ok,
    'inconclusivo', v_inconclusivo,
    'status', v_row.status,
    'ambiente', v_ambiente,
    'ambienteAtivo', v_active,
    'erro', v_erro
  );
END;
$$;
