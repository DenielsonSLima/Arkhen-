-- Garante que uma rotina so possa herdar checklist de um modelo do mesmo tenant.
-- Rotinas legadas sem modelo continuam validas para permitir vinculacao gradual.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.atividades_rotinas r
    WHERE r.modelo_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.atividades_modelos m
        WHERE m.id = r.modelo_id
          AND m.empresa_id = r.empresa_id
      )
  ) THEN
    RAISE EXCEPTION
      'Existem rotinas vinculadas a modelos ausentes ou de outro tenant; revise antes da migration.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS atividades_modelos_id_empresa_id_unq
  ON public.atividades_modelos (id, empresa_id);

DO $$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.atividades_rotinas'::regclass
      AND con.confrelid = 'public.atividades_modelos'::regclass
      AND con.contype = 'f'
      AND EXISTS (
        SELECT 1
        FROM unnest(con.conkey) AS k(attnum)
        JOIN pg_attribute a
          ON a.attrelid = con.conrelid
         AND a.attnum = k.attnum
        WHERE a.attname = 'modelo_id'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.atividades_rotinas DROP CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;

  ALTER TABLE public.atividades_rotinas
    ADD CONSTRAINT atividades_rotinas_modelo_tenant_fkey
    FOREIGN KEY (modelo_id, empresa_id)
    REFERENCES public.atividades_modelos (id, empresa_id)
    ON DELETE SET NULL (modelo_id);
END;
$$;

-- Cobre integralmente as colunas referenciais, inclusive rotinas inativas,
-- para validacoes e exclusoes no lado de atividades_modelos.
CREATE INDEX IF NOT EXISTS idx_atividades_rotinas_modelo_empresa
  ON public.atividades_rotinas (modelo_id, empresa_id);
