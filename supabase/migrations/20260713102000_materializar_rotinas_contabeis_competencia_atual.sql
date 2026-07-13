-- Materializa as rotinas contábeis pré-cadastradas para clientes existentes
-- na competência operacional atual do sistema.

CREATE OR REPLACE FUNCTION public.set_atividades_instancias_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_atividades_instancias ON public.atividades_instancias;
CREATE TRIGGER set_updated_at_atividades_instancias
  BEFORE UPDATE ON public.atividades_instancias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_atividades_instancias_atualizado_em();

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
    '06/2026',
    'Pendente',
    COALESCE(default_checklist.checklists, '{}'::jsonb),
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
  ) default_checklist
  WHERE c.status = 'Ativa'
  ON CONFLICT (empresa_id, cliente_id, modelo_id, competencia)
    WHERE ativo = true
      AND cliente_id IS NOT NULL
      AND modelo_id IS NOT NULL
    DO NOTHING
  RETURNING id
),
merged AS (
  SELECT
    ai.id,
    COALESCE(default_checklist.checklists, '{}'::jsonb) || COALESCE(ai.checklists, '{}'::jsonb) AS merged_checklists
  FROM public.atividades_instancias ai
  JOIN public.atividades_modelos am
    ON am.id = ai.modelo_id
   AND am.empresa_id = ai.empresa_id
  CROSS JOIN LATERAL (
    SELECT COALESCE(jsonb_object_agg(etapa.nome, false), '{}'::jsonb) AS checklists
    FROM jsonb_array_elements_text(am.etapas) AS etapa(nome)
  ) default_checklist
  WHERE ai.ativo = true
    AND ai.competencia = '06/2026'
)
UPDATE public.atividades_instancias ai
SET checklists = merged.merged_checklists,
    atualizado_em = now()
FROM merged
WHERE ai.id = merged.id;
