-- Materializa checklists mensais por cliente e impede sobras/duplicidades.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY empresa_id, cliente_id, modelo_id, competencia
      ORDER BY atualizado_em DESC, criado_em DESC, id DESC
    ) AS rn
  FROM public.atividades_instancias
  WHERE ativo = true
    AND cliente_id IS NOT NULL
    AND modelo_id IS NOT NULL
)
UPDATE public.atividades_instancias ai
SET ativo = false,
    atualizado_em = now()
FROM ranked r
WHERE ai.id = r.id
  AND r.rn > 1;

ALTER TABLE public.atividades_instancias
  DROP CONSTRAINT IF EXISTS atividades_instancias_cliente_id_fkey,
  ADD CONSTRAINT atividades_instancias_cliente_id_fkey
    FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_atividades_instancias_active_unique
  ON public.atividades_instancias (empresa_id, cliente_id, modelo_id, competencia)
  WHERE ativo = true
    AND cliente_id IS NOT NULL
    AND modelo_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_atividades_instancias(p_competencia varchar)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_inserted integer := 0;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa atual nao encontrada para materializar atividades.';
  END IF;

  IF p_competencia IS NULL OR btrim(p_competencia) = '' THEN
    RAISE EXCEPTION 'Competencia obrigatoria para materializar atividades.';
  END IF;

  UPDATE public.atividades_instancias ai
  SET cliente_nome = c.nome,
      modelo_codigo = am.codigo,
      atualizado_em = now()
  FROM public.clientes c
  JOIN public.atividades_modelos am ON am.id = ai.modelo_id
  WHERE ai.empresa_id = v_empresa_id
    AND ai.cliente_id = c.id
    AND c.empresa_id = v_empresa_id
    AND ai.ativo = true
    AND ai.competencia = p_competencia
    AND (ai.cliente_nome IS DISTINCT FROM c.nome OR ai.modelo_codigo IS DISTINCT FROM am.codigo);

  WITH inserted AS (
    INSERT INTO public.atividades_instancias (
      empresa_id,
      cliente_id,
      modelo_id,
      cliente_nome,
      modelo_codigo,
      competencia,
      status,
      checklists,
      checklist_dates,
      checklist_users,
      valores,
      ativo
    )
    SELECT
      c.empresa_id,
      c.id,
      am.id,
      c.nome,
      am.codigo,
      p_competencia,
      'Pendente',
      checklist.checklists,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      true
    FROM public.clientes c
    JOIN public.atividades_modelos am
      ON am.empresa_id = c.empresa_id
     AND am.ativo = true
     AND am.id::text = ANY(c.modelos_ativos)
    CROSS JOIN LATERAL (
      SELECT COALESCE(jsonb_object_agg(etapa.nome, false), '{}'::jsonb) AS checklists
      FROM jsonb_array_elements_text(am.etapas) AS etapa(nome)
    ) checklist
    WHERE c.empresa_id = v_empresa_id
      AND c.status = 'Ativa'
    ON CONFLICT (empresa_id, cliente_id, modelo_id, competencia)
      WHERE ativo = true
        AND cliente_id IS NOT NULL
        AND modelo_id IS NOT NULL
      DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_atividades_instancias(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_atividades_instancias(varchar) TO authenticated;
