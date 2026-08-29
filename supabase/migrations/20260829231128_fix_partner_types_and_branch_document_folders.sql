-- Relacionamento de parceiros é distinto da categoria operacional do cliente.
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_parceiro_id uuid,
  ADD COLUMN IF NOT EXISTS tipo_parceiro_catalogo_tipo varchar NOT NULL DEFAULT 'tipos_parceiros';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'parametrizacao_catalogos_id_empresa_tipo_unq'
      AND conrelid = 'public.parametrizacao_catalogos'::regclass
  ) THEN
    ALTER TABLE public.parametrizacao_catalogos
      ADD CONSTRAINT parametrizacao_catalogos_id_empresa_tipo_unq
      UNIQUE (id, empresa_id, tipo);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clientes_tipo_parceiro_catalogo_tipo_check'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_tipo_parceiro_catalogo_tipo_check
      CHECK (tipo_parceiro_catalogo_tipo = 'tipos_parceiros');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clientes_tipo_parceiro_tenant_fk'
      AND conrelid = 'public.clientes'::regclass
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_tipo_parceiro_tenant_fk
      FOREIGN KEY (tipo_parceiro_id, empresa_id, tipo_parceiro_catalogo_tipo)
      REFERENCES public.parametrizacao_catalogos (id, empresa_id, tipo)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS clientes_empresa_tipo_parceiro_idx
  ON public.clientes (empresa_id, tipo_parceiro_id)
  WHERE tipo_parceiro_id IS NOT NULL;

-- Cada filial possui um caminho virtual estável na biblioteca de documentos da matriz.
CREATE OR REPLACE FUNCTION public.sync_clientes_filiais_pastas_documentos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_branch jsonb;
  v_normalized_polos jsonb := '[]'::jsonb;
  v_paths text[] := COALESCE(NEW.pastas_documentos, '{}'::text[]);
  v_path text;
  v_name text;
  v_identity text;
  v_index integer := 0;
BEGIN
  FOR v_branch IN
    SELECT value
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(NEW.polos, '[]'::jsonb)) = 'array' THEN NEW.polos
        ELSE '[]'::jsonb
      END
    )
  LOOP
    v_index := v_index + 1;
    v_path := NULLIF(trim(v_branch ->> 'documentFolderPath'), '');

    IF v_path IS NULL THEN
      v_name := regexp_replace(trim(COALESCE(v_branch ->> 'nome', '')), '[[:space:]/]+', ' ', 'g');
      v_identity := regexp_replace(
        trim(COALESCE(NULLIF(v_branch ->> 'cnpj', ''), NULLIF(v_branch ->> 'id', ''), v_index::text)),
        '[[:space:]/]+',
        ' ',
        'g'
      );
      v_path := format('Filiais/%s - %s', LEFT(COALESCE(NULLIF(v_name, ''), 'Filial'), 80), LEFT(v_identity, 50));
    END IF;

    v_branch := jsonb_set(v_branch, '{documentFolderPath}', to_jsonb(v_path), true);
    v_normalized_polos := v_normalized_polos || jsonb_build_array(v_branch);
    v_paths := array_append(v_paths, v_path);
  END LOOP;

  NEW.polos := v_normalized_polos;
  NEW.pastas_documentos := public.expand_pastas_documentos_paths(v_paths);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_clientes_filiais_pastas_documentos_before_write ON public.clientes;
CREATE TRIGGER sync_clientes_filiais_pastas_documentos_before_write
  BEFORE INSERT OR UPDATE OF polos ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_clientes_filiais_pastas_documentos();

-- Inclui a pasta das filiais já cadastradas, preservando os dados da filial.
UPDATE public.clientes
SET polos = polos
WHERE jsonb_typeof(polos) = 'array'
  AND jsonb_array_length(polos) > 0;
