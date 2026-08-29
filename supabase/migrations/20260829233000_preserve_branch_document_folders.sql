-- Mantém as pastas geradas por filiais ao salvar preferências da Biblioteca.
-- O caminho de uma filial é sempre virtual, estável e limitado à raiz Filiais.
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

    IF v_path IS NULL
      OR v_path !~ '^Filiais/[^/]+$'
      OR v_path ~ '(^|/)(\.|\.\.)(/|$)'
    THEN
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
  BEFORE INSERT OR UPDATE OF polos, pastas_documentos ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_clientes_filiais_pastas_documentos();
