-- Alinha a escrita da marca d'agua ao RBAC exposto na interface.

DROP POLICY IF EXISTS configuracoes_marca_dagua_policy
  ON public.configuracoes_marca_dagua;
DROP POLICY IF EXISTS isolamento_cliente_interno
  ON public.configuracoes_marca_dagua;
DROP POLICY IF EXISTS tenant_membership_guard
  ON public.configuracoes_marca_dagua;
DROP POLICY IF EXISTS marca_dagua_select_member
  ON public.configuracoes_marca_dagua;
DROP POLICY IF EXISTS marca_dagua_insert_manager
  ON public.configuracoes_marca_dagua;
DROP POLICY IF EXISTS marca_dagua_update_manager
  ON public.configuracoes_marca_dagua;
DROP POLICY IF EXISTS marca_dagua_delete_manager
  ON public.configuracoes_marca_dagua;

CREATE POLICY marca_dagua_select_member
  ON public.configuracoes_marca_dagua
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(empresa_id));

CREATE POLICY marca_dagua_insert_manager
  ON public.configuracoes_marca_dagua
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_empresa_member(empresa_id)
    AND NOT COALESCE(public.current_user_is_client_scoped(empresa_id), true)
    AND public.current_user_has_permission(empresa_id, 'documentos:manage')
  );

CREATE POLICY marca_dagua_update_manager
  ON public.configuracoes_marca_dagua
  FOR UPDATE TO authenticated
  USING (
    public.is_empresa_member(empresa_id)
    AND NOT COALESCE(public.current_user_is_client_scoped(empresa_id), true)
    AND public.current_user_has_permission(empresa_id, 'documentos:manage')
  )
  WITH CHECK (
    public.is_empresa_member(empresa_id)
    AND NOT COALESCE(public.current_user_is_client_scoped(empresa_id), true)
    AND public.current_user_has_permission(empresa_id, 'documentos:manage')
  );

CREATE POLICY marca_dagua_delete_manager
  ON public.configuracoes_marca_dagua
  FOR DELETE TO authenticated
  USING (
    public.is_empresa_member(empresa_id)
    AND NOT COALESCE(public.current_user_is_client_scoped(empresa_id), true)
    AND public.current_user_has_permission(empresa_id, 'documentos:manage')
  );

CREATE OR REPLACE FUNCTION public.upsert_configuracoes_marca_dagua(p_payload jsonb)
RETURNS public.configuracoes_marca_dagua
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_existente public.configuracoes_marca_dagua%rowtype;
  v_resultado public.configuracoes_marca_dagua%rowtype;
  v_posicao_paisagem text;
  v_posicao_retrato text;
  v_posicao_legado text;
  v_opacidade_paisagem integer;
  v_opacidade_retrato integer;
  v_opacidade_legado integer;
  v_tamanho_paisagem integer;
  v_tamanho_retrato integer;
  v_tamanho_legado integer;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'documentos:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Sem permissao para alterar a marca d''agua.'
      USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR octet_length(COALESCE(p_payload::text, '')) > 32768 THEN
    RAISE EXCEPTION 'Configuracao de marca d''agua invalida.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existente
  FROM public.configuracoes_marca_dagua
  WHERE empresa_id = v_empresa_id
  FOR UPDATE;

  v_posicao_paisagem := CASE
    WHEN p_payload->>'posicao_paisagem' IN (
      'topo-esquerda', 'topo-direita', 'centro', 'rodape-direita'
    ) THEN p_payload->>'posicao_paisagem'
    WHEN p_payload->>'posicao' IN (
      'topo-esquerda', 'topo-direita', 'centro', 'rodape-direita'
    ) THEN p_payload->>'posicao'
    ELSE COALESCE(v_existente.posicao_paisagem, v_existente.posicao, 'centro')
  END;
  v_posicao_retrato := CASE
    WHEN p_payload->>'posicao_retrato' IN (
      'topo-esquerda', 'topo-direita', 'centro', 'rodape-direita'
    ) THEN p_payload->>'posicao_retrato'
    WHEN p_payload->>'posicao' IN (
      'topo-esquerda', 'topo-direita', 'centro', 'rodape-direita'
    ) THEN p_payload->>'posicao'
    ELSE COALESCE(v_existente.posicao_retrato, v_existente.posicao, 'centro')
  END;
  v_posicao_legado := CASE
    WHEN p_payload->>'posicao' IN (
      'topo-esquerda', 'topo-direita', 'centro', 'rodape-direita'
    ) THEN p_payload->>'posicao'
    ELSE COALESCE(v_existente.posicao, v_posicao_paisagem)
  END;

  v_opacidade_paisagem := LEAST(100, GREATEST(0, CASE
    WHEN p_payload->>'opacidade_paisagem' ~ '^[0-9]{1,3}$'
      THEN (p_payload->>'opacidade_paisagem')::integer
    WHEN p_payload->>'opacidade' ~ '^[0-9]{1,3}$'
      THEN (p_payload->>'opacidade')::integer
    ELSE COALESCE(v_existente.opacidade_paisagem, v_existente.opacidade, 15)
  END));
  v_opacidade_retrato := LEAST(100, GREATEST(0, CASE
    WHEN p_payload->>'opacidade_retrato' ~ '^[0-9]{1,3}$'
      THEN (p_payload->>'opacidade_retrato')::integer
    WHEN p_payload->>'opacidade' ~ '^[0-9]{1,3}$'
      THEN (p_payload->>'opacidade')::integer
    ELSE COALESCE(v_existente.opacidade_retrato, v_existente.opacidade, 15)
  END));
  v_opacidade_legado := LEAST(100, GREATEST(0, CASE
    WHEN p_payload->>'opacidade' ~ '^[0-9]{1,3}$'
      THEN (p_payload->>'opacidade')::integer
    ELSE COALESCE(v_existente.opacidade, v_opacidade_paisagem)
  END));

  v_tamanho_paisagem := LEAST(100, GREATEST(10, CASE
    WHEN p_payload->>'tamanho_paisagem' ~ '^[0-9]{1,3}$'
      THEN (p_payload->>'tamanho_paisagem')::integer
    WHEN p_payload->>'tamanho' ~ '^[0-9]{1,3}$'
      THEN (p_payload->>'tamanho')::integer
    ELSE COALESCE(v_existente.tamanho_paisagem, v_existente.tamanho, 35)
  END));
  v_tamanho_retrato := LEAST(100, GREATEST(10, CASE
    WHEN p_payload->>'tamanho_retrato' ~ '^[0-9]{1,3}$'
      THEN (p_payload->>'tamanho_retrato')::integer
    WHEN p_payload->>'tamanho' ~ '^[0-9]{1,3}$'
      THEN (p_payload->>'tamanho')::integer
    ELSE COALESCE(v_existente.tamanho_retrato, v_existente.tamanho, 35)
  END));
  v_tamanho_legado := LEAST(100, GREATEST(10, CASE
    WHEN p_payload->>'tamanho' ~ '^[0-9]{1,3}$'
      THEN (p_payload->>'tamanho')::integer
    ELSE COALESCE(v_existente.tamanho, v_tamanho_paisagem)
  END));

  INSERT INTO public.configuracoes_marca_dagua (
    empresa_id, habilitado, file_url, file_url_paisagem, file_url_retrato,
    posicao, opacidade, tamanho, posicao_paisagem, posicao_retrato,
    opacidade_paisagem, opacidade_retrato, tamanho_paisagem, tamanho_retrato
  ) VALUES (
    v_empresa_id,
    COALESCE((p_payload->>'habilitado')::boolean, v_existente.habilitado, false),
    CASE WHEN p_payload ? 'file_url'
      THEN NULLIF(p_payload->>'file_url', '') ELSE v_existente.file_url END,
    CASE WHEN p_payload ? 'file_url_paisagem'
      THEN NULLIF(p_payload->>'file_url_paisagem', '')
      ELSE v_existente.file_url_paisagem END,
    CASE WHEN p_payload ? 'file_url_retrato'
      THEN NULLIF(p_payload->>'file_url_retrato', '')
      ELSE v_existente.file_url_retrato END,
    v_posicao_legado, v_opacidade_legado, v_tamanho_legado,
    v_posicao_paisagem, v_posicao_retrato,
    v_opacidade_paisagem, v_opacidade_retrato,
    v_tamanho_paisagem, v_tamanho_retrato
  )
  ON CONFLICT (empresa_id) DO UPDATE SET
    habilitado = excluded.habilitado,
    file_url = excluded.file_url,
    file_url_paisagem = excluded.file_url_paisagem,
    file_url_retrato = excluded.file_url_retrato,
    posicao = excluded.posicao,
    opacidade = excluded.opacidade,
    tamanho = excluded.tamanho,
    posicao_paisagem = excluded.posicao_paisagem,
    posicao_retrato = excluded.posicao_retrato,
    opacidade_paisagem = excluded.opacidade_paisagem,
    opacidade_retrato = excluded.opacidade_retrato,
    tamanho_paisagem = excluded.tamanho_paisagem,
    tamanho_retrato = excluded.tamanho_retrato,
    updated_at = now()
  RETURNING * INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_configuracoes_marca_dagua(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_configuracoes_marca_dagua(jsonb)
  TO authenticated;
