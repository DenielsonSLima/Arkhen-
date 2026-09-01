-- Registra no histórico local o contrato por orientação já usado pela aplicação.
-- Mantém fallback legado sem misturar os valores de Retrato e Paisagem.

ALTER TABLE public.configuracoes_marca_dagua
  ADD COLUMN IF NOT EXISTS posicao_paisagem text,
  ADD COLUMN IF NOT EXISTS posicao_retrato text,
  ADD COLUMN IF NOT EXISTS opacidade_paisagem integer,
  ADD COLUMN IF NOT EXISTS opacidade_retrato integer,
  ADD COLUMN IF NOT EXISTS tamanho_paisagem integer,
  ADD COLUMN IF NOT EXISTS tamanho_retrato integer;

UPDATE public.configuracoes_marca_dagua
SET posicao_paisagem = COALESCE(posicao_paisagem, posicao, 'centro'),
    posicao_retrato = COALESCE(posicao_retrato, posicao, 'centro'),
    opacidade_paisagem = COALESCE(opacidade_paisagem, opacidade, 15),
    opacidade_retrato = COALESCE(opacidade_retrato, opacidade, 15),
    tamanho_paisagem = COALESCE(tamanho_paisagem, tamanho, 35),
    tamanho_retrato = COALESCE(tamanho_retrato, tamanho, 35);

ALTER TABLE public.configuracoes_marca_dagua
  ALTER COLUMN posicao_paisagem SET DEFAULT 'centro',
  ALTER COLUMN posicao_paisagem SET NOT NULL,
  ALTER COLUMN posicao_retrato SET DEFAULT 'centro',
  ALTER COLUMN posicao_retrato SET NOT NULL,
  ALTER COLUMN opacidade_paisagem SET DEFAULT 15,
  ALTER COLUMN opacidade_paisagem SET NOT NULL,
  ALTER COLUMN opacidade_retrato SET DEFAULT 15,
  ALTER COLUMN opacidade_retrato SET NOT NULL,
  ALTER COLUMN tamanho_paisagem SET DEFAULT 35,
  ALTER COLUMN tamanho_paisagem SET NOT NULL,
  ALTER COLUMN tamanho_retrato SET DEFAULT 35,
  ALTER COLUMN tamanho_retrato SET NOT NULL;

ALTER TABLE public.configuracoes_marca_dagua
  DROP CONSTRAINT IF EXISTS configuracoes_marca_dagua_posicao_paisagem_check,
  DROP CONSTRAINT IF EXISTS configuracoes_marca_dagua_posicao_retrato_check,
  DROP CONSTRAINT IF EXISTS configuracoes_marca_dagua_opacidade_paisagem_check,
  DROP CONSTRAINT IF EXISTS configuracoes_marca_dagua_opacidade_retrato_check,
  DROP CONSTRAINT IF EXISTS configuracoes_marca_dagua_tamanho_paisagem_check,
  DROP CONSTRAINT IF EXISTS configuracoes_marca_dagua_tamanho_retrato_check;

ALTER TABLE public.configuracoes_marca_dagua
  ADD CONSTRAINT configuracoes_marca_dagua_posicao_paisagem_check
    CHECK (posicao_paisagem IN ('topo-esquerda', 'topo-direita', 'centro', 'rodape-direita')),
  ADD CONSTRAINT configuracoes_marca_dagua_posicao_retrato_check
    CHECK (posicao_retrato IN ('topo-esquerda', 'topo-direita', 'centro', 'rodape-direita')),
  ADD CONSTRAINT configuracoes_marca_dagua_opacidade_paisagem_check
    CHECK (opacidade_paisagem BETWEEN 0 AND 100),
  ADD CONSTRAINT configuracoes_marca_dagua_opacidade_retrato_check
    CHECK (opacidade_retrato BETWEEN 0 AND 100),
  ADD CONSTRAINT configuracoes_marca_dagua_tamanho_paisagem_check
    CHECK (tamanho_paisagem BETWEEN 10 AND 100),
  ADD CONSTRAINT configuracoes_marca_dagua_tamanho_retrato_check
    CHECK (tamanho_retrato BETWEEN 10 AND 100);

CREATE OR REPLACE FUNCTION public.upsert_configuracoes_marca_dagua(p_payload jsonb)
RETURNS public.configuracoes_marca_dagua
LANGUAGE plpgsql
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
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR octet_length(COALESCE(p_payload::text, '')) > 32768 THEN
    RAISE EXCEPTION 'Configuracao de marca d''agua invalida.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existente
  FROM public.configuracoes_marca_dagua
  WHERE empresa_id = v_empresa_id
  FOR UPDATE;

  v_posicao_paisagem := CASE
    WHEN p_payload->>'posicao_paisagem' IN ('topo-esquerda', 'topo-direita', 'centro', 'rodape-direita')
      THEN p_payload->>'posicao_paisagem'
    WHEN p_payload->>'posicao' IN ('topo-esquerda', 'topo-direita', 'centro', 'rodape-direita')
      THEN p_payload->>'posicao'
    ELSE COALESCE(v_existente.posicao_paisagem, v_existente.posicao, 'centro')
  END;
  v_posicao_retrato := CASE
    WHEN p_payload->>'posicao_retrato' IN ('topo-esquerda', 'topo-direita', 'centro', 'rodape-direita')
      THEN p_payload->>'posicao_retrato'
    WHEN p_payload->>'posicao' IN ('topo-esquerda', 'topo-direita', 'centro', 'rodape-direita')
      THEN p_payload->>'posicao'
    ELSE COALESCE(v_existente.posicao_retrato, v_existente.posicao, 'centro')
  END;
  v_posicao_legado := CASE
    WHEN p_payload->>'posicao' IN ('topo-esquerda', 'topo-direita', 'centro', 'rodape-direita')
      THEN p_payload->>'posicao'
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
    CASE WHEN p_payload ? 'file_url' THEN NULLIF(p_payload->>'file_url', '') ELSE v_existente.file_url END,
    CASE WHEN p_payload ? 'file_url_paisagem' THEN NULLIF(p_payload->>'file_url_paisagem', '') ELSE v_existente.file_url_paisagem END,
    CASE WHEN p_payload ? 'file_url_retrato' THEN NULLIF(p_payload->>'file_url_retrato', '') ELSE v_existente.file_url_retrato END,
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
