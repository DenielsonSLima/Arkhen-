-- Mantem as mensagens globais, mas a escolha diaria varia por empresa.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mensagens_inspiradoras_somente_globais_chk'
      AND conrelid = 'public.mensagens_inspiradoras'::regclass
  ) THEN
    ALTER TABLE public.mensagens_inspiradoras
      ADD CONSTRAINT mensagens_inspiradoras_somente_globais_chk
      CHECK (empresa_id IS NULL) NOT VALID;
  END IF;
END;
$$;

UPDATE public.mensagens_inspiradoras
SET empresa_id = NULL
WHERE empresa_id IS NOT NULL;

ALTER TABLE public.mensagens_inspiradoras
  VALIDATE CONSTRAINT mensagens_inspiradoras_somente_globais_chk;

DROP POLICY IF EXISTS mensagens_inspiradoras_select_policy ON public.mensagens_inspiradoras;
CREATE POLICY mensagens_inspiradoras_select_policy ON public.mensagens_inspiradoras
  FOR SELECT TO authenticated
  USING (empresa_id IS NULL);

DROP POLICY IF EXISTS mensagens_inspiradoras_write_policy ON public.mensagens_inspiradoras;

CREATE OR REPLACE FUNCTION public.get_mensagem_inspiradora_do_dia(p_data date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  id uuid,
  texto text,
  autor varchar,
  categoria varchar,
  ordem integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_total integer;
  v_posicao integer;
  v_data date := COALESCE(p_data, CURRENT_DATE);
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa atual nao encontrada.';
  END IF;

  SELECT count(*)
    INTO v_total
  FROM public.mensagens_inspiradoras mi
  WHERE mi.ativo = true
    AND mi.empresa_id IS NULL;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  v_posicao := (((v_data - DATE '2026-01-01') % v_total + v_total) % v_total) + 1;

  RETURN QUERY
  WITH mensagens_embaralhadas AS (
    SELECT
      mi.id,
      mi.texto,
      mi.autor,
      mi.categoria,
      mi.ordem,
      row_number() OVER (
        ORDER BY md5(v_empresa_id::text || ':' || mi.codigo), mi.codigo
      )::integer AS posicao
    FROM public.mensagens_inspiradoras mi
    WHERE mi.ativo = true
      AND mi.empresa_id IS NULL
  )
  SELECT m.id, m.texto, m.autor, m.categoria, m.ordem
  FROM mensagens_embaralhadas m
  WHERE m.posicao = v_posicao
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_mensagem_inspiradora_do_dia(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mensagem_inspiradora_do_dia(date) TO authenticated;
