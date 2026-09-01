-- A parametrização da única calculadora mantida passa a ser configuração do
-- escritório, e não preferência local de cada usuário.

CREATE TABLE IF NOT EXISTS public.configuracoes_rescisao (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  configuracao jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_rescisao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracoes_rescisao_select ON public.configuracoes_rescisao;
DROP POLICY IF EXISTS configuracoes_rescisao_manage ON public.configuracoes_rescisao;

CREATE POLICY configuracoes_rescisao_select
  ON public.configuracoes_rescisao
  FOR SELECT TO authenticated
  USING (
    NOT COALESCE(public.current_user_is_client_scoped(empresa_id), true)
    AND (
      public.current_user_has_permission(empresa_id, 'simulacoes:view')
      OR public.current_user_has_permission(empresa_id, 'parametrizacao:view')
      OR public.current_user_has_permission(empresa_id, 'parametrizacao:manage')
    )
  );

CREATE POLICY configuracoes_rescisao_manage
  ON public.configuracoes_rescisao
  FOR ALL TO authenticated
  USING (
    NOT COALESCE(public.current_user_is_client_scoped(empresa_id), true)
    AND public.current_user_has_permission(empresa_id, 'parametrizacao:manage')
  )
  WITH CHECK (
    NOT COALESCE(public.current_user_is_client_scoped(empresa_id), true)
    AND public.current_user_has_permission(empresa_id, 'parametrizacao:manage')
  );

DROP TRIGGER IF EXISTS set_configuracoes_rescisao_updated_at
  ON public.configuracoes_rescisao;
CREATE TRIGGER set_configuracoes_rescisao_updated_at
  BEFORE UPDATE ON public.configuracoes_rescisao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION app_private.configuracao_rescisao_padrao()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'version', 5,
    'tiposRescisao', jsonb_build_array(
      jsonb_build_object(
        'id', 'sem_justa_causa',
        'label', 'Sem Justa Causa',
        'descricao', 'Com aviso prévio e multa de FGTS.',
        'geraAvisoPrevio', true,
        'geraMultaFgts', true,
        'ativo', true
      ),
      jsonb_build_object(
        'id', 'com_justa_causa',
        'label', 'Com Justa Causa',
        'descricao', 'Sem aviso prévio indenizado e sem multa de FGTS.',
        'geraAvisoPrevio', false,
        'geraMultaFgts', false,
        'ativo', true
      ),
      jsonb_build_object(
        'id', 'pedido_demissao',
        'label', 'Pedido de Demissão',
        'descricao', 'Pedido do funcionário, sem multa de FGTS.',
        'geraAvisoPrevio', false,
        'geraMultaFgts', false,
        'ativo', true
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION app_private.normalizar_configuracao_rescisao(
  p_configuracao jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_padrao jsonb := app_private.configuracao_rescisao_padrao();
  v_tipos jsonb := p_configuracao -> 'tiposRescisao';
  v_resultado jsonb := '[]'::jsonb;
  v_padrao_item jsonb;
  v_item jsonb;
  v_id text;
  v_label text;
  v_descricao text;
  v_ativo boolean;
  v_ativos integer := 0;
BEGIN
  IF jsonb_typeof(p_configuracao) <> 'object'
     OR jsonb_typeof(v_tipos) <> 'array'
     OR jsonb_array_length(v_tipos) <> 3 THEN
    RAISE EXCEPTION 'Configuração de rescisão inválida.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_tipos) elemento
    WHERE elemento ->> 'id' NOT IN (
      'sem_justa_causa',
      'com_justa_causa',
      'pedido_demissao'
    )
  ) OR (
    SELECT count(DISTINCT elemento ->> 'id')
    FROM jsonb_array_elements(v_tipos) elemento
  ) <> 3 THEN
    RAISE EXCEPTION 'Tipos de rescisão inválidos.' USING ERRCODE = '22023';
  END IF;

  FOR v_padrao_item IN
    SELECT elemento FROM jsonb_array_elements(v_padrao -> 'tiposRescisao') elemento
  LOOP
    v_id := v_padrao_item ->> 'id';
    SELECT elemento INTO v_item
    FROM jsonb_array_elements(v_tipos) elemento
    WHERE elemento ->> 'id' = v_id;

    IF jsonb_typeof(v_item -> 'label') <> 'string'
       OR jsonb_typeof(v_item -> 'descricao') <> 'string'
       OR jsonb_typeof(v_item -> 'ativo') <> 'boolean' THEN
      RAISE EXCEPTION 'Campos do tipo de rescisão inválidos.' USING ERRCODE = '22023';
    END IF;

    v_label := btrim(v_item ->> 'label');
    v_descricao := btrim(v_item ->> 'descricao');
    v_ativo := (v_item ->> 'ativo')::boolean;
    IF char_length(v_label) NOT BETWEEN 1 AND 80
       OR char_length(v_descricao) NOT BETWEEN 1 AND 240 THEN
      RAISE EXCEPTION 'Rótulo ou descrição da rescisão inválido.' USING ERRCODE = '22023';
    END IF;

    IF v_ativo THEN v_ativos := v_ativos + 1; END IF;
    v_resultado := v_resultado || jsonb_build_array(jsonb_build_object(
      'id', v_id,
      'label', v_label,
      'descricao', v_descricao,
      'geraAvisoPrevio', (v_padrao_item ->> 'geraAvisoPrevio')::boolean,
      'geraMultaFgts', (v_padrao_item ->> 'geraMultaFgts')::boolean,
      'ativo', v_ativo
    ));
  END LOOP;

  IF v_ativos = 0 THEN
    RAISE EXCEPTION 'Mantenha ao menos um tipo de rescisão ativo.' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('version', 5, 'tiposRescisao', v_resultado);
END;
$$;

-- Importa os três motivos da preferência válida mais recente de cada tenant e
-- só então remove o payload que ainda continha simuladores excluídos.
DO $$
DECLARE
  v_empresa record;
  v_preferencia record;
  v_configuracao jsonb;
  v_importada boolean;
BEGIN
  FOR v_empresa IN
    SELECT DISTINCT preferencia.empresa_id
    FROM public.preferencias_usuario_modulos preferencia
    WHERE preferencia.modulo = 'app-local-storage'
      AND preferencia.chave = 'contabil_parametrizacao_parametros_calculo'
  LOOP
    v_importada := EXISTS (
      SELECT 1 FROM public.configuracoes_rescisao configuracao
      WHERE configuracao.empresa_id = v_empresa.empresa_id
    );

    IF NOT v_importada THEN
      FOR v_preferencia IN
        SELECT preferencia.valor, preferencia.updated_at
        FROM public.preferencias_usuario_modulos preferencia
        WHERE preferencia.empresa_id = v_empresa.empresa_id
          AND preferencia.modulo = 'app-local-storage'
          AND preferencia.chave = 'contabil_parametrizacao_parametros_calculo'
        ORDER BY preferencia.updated_at DESC
      LOOP
        BEGIN
          v_configuracao := CASE jsonb_typeof(v_preferencia.valor)
            WHEN 'string' THEN (v_preferencia.valor #>> '{}')::jsonb
            ELSE v_preferencia.valor
          END;
          v_configuracao := app_private.normalizar_configuracao_rescisao(v_configuracao);
        EXCEPTION
          WHEN invalid_text_representation OR invalid_parameter_value THEN
            CONTINUE;
        END;

        INSERT INTO public.configuracoes_rescisao (
          empresa_id, configuracao, created_at, updated_at
        ) VALUES (
          v_empresa.empresa_id,
          v_configuracao,
          v_preferencia.updated_at,
          v_preferencia.updated_at
        );
        v_importada := true;
        EXIT;
      END LOOP;
    END IF;

    IF NOT v_importada THEN
      INSERT INTO public.configuracoes_rescisao (empresa_id, configuracao)
      VALUES (v_empresa.empresa_id, app_private.configuracao_rescisao_padrao());
    END IF;

    DELETE FROM public.preferencias_usuario_modulos
    WHERE empresa_id = v_empresa.empresa_id
      AND modulo = 'app-local-storage'
      AND chave = 'contabil_parametrizacao_parametros_calculo';
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_configuracao_rescisao()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_configuracao jsonb;
  v_updated_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'simulacoes:view')
       OR public.current_user_has_permission(v_empresa_id, 'parametrizacao:view')
       OR public.current_user_has_permission(v_empresa_id, 'parametrizacao:manage'),
       false
     ) THEN
    RAISE EXCEPTION 'Configuração de rescisão não encontrada.' USING ERRCODE = '42501';
  END IF;

  SELECT configuracao, updated_at
  INTO v_configuracao, v_updated_at
  FROM public.configuracoes_rescisao
  WHERE empresa_id = v_empresa_id;

  RETURN COALESCE(
    v_configuracao,
    app_private.configuracao_rescisao_padrao()
  ) || jsonb_build_object('updatedAt', to_jsonb(v_updated_at));
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_configuracao_rescisao(
  p_configuracao jsonb,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_configuracao jsonb;
  v_updated_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR NOT COALESCE(
       public.current_user_has_permission(v_empresa_id, 'parametrizacao:manage'), false
     ) THEN
    RAISE EXCEPTION 'Configuração de rescisão não encontrada.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.empresas WHERE id = v_empresa_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configuração de rescisão não encontrada.' USING ERRCODE = '42501';
  END IF;

  SELECT updated_at INTO v_updated_at
  FROM public.configuracoes_rescisao
  WHERE empresa_id = v_empresa_id
  FOR UPDATE;
  IF FOUND THEN
    IF p_expected_updated_at IS NULL
       OR v_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Configuração alterada por outro usuário.' USING ERRCODE = '40001';
    END IF;
  ELSIF p_expected_updated_at IS NOT NULL THEN
    RAISE EXCEPTION 'Configuração alterada por outro usuário.' USING ERRCODE = '40001';
  END IF;

  v_configuracao := app_private.normalizar_configuracao_rescisao(p_configuracao);
  INSERT INTO public.configuracoes_rescisao (empresa_id, configuracao)
  VALUES (v_empresa_id, v_configuracao)
  ON CONFLICT (empresa_id) DO UPDATE
    SET configuracao = EXCLUDED.configuracao
  RETURNING configuracao, updated_at
  INTO v_configuracao, v_updated_at;

  RETURN v_configuracao || jsonb_build_object('updatedAt', to_jsonb(v_updated_at));
END;
$$;

REVOKE ALL ON TABLE public.configuracoes_rescisao FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.obter_configuracao_rescisao() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.salvar_configuracao_rescisao(jsonb, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_configuracao_rescisao() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_configuracao_rescisao(jsonb, timestamptz)
  TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'configuracoes_rescisao'
     ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.configuracoes_rescisao;
  END IF;
END;
$$;
