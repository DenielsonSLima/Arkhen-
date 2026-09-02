BEGIN;

SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';

LOCK TABLE public.clientes IN SHARE ROW EXCLUSIVE MODE;

-- Nao instala uma regra mais estrita sobre hierarquias inconsistentes. Assim,
-- a migration falha antes de publicar a nova RPC e permite saneamento explicito.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.clientes filial
    JOIN public.clientes matriz
      ON matriz.empresa_id = filial.empresa_id
     AND matriz.id = filial.matriz_cliente_id
    WHERE filial.matriz_cliente_id IS NOT NULL
      AND (
        filial.tipo = 'PF'
        OR matriz.tipo = 'PF'
        OR filial.tipo_estabelecimento <> 'Filial'
        OR matriz.tipo_estabelecimento <> 'Matriz'
        OR NOT app_private.cnpj_alfanumerico_valido(filial.cnpj)
        OR NOT app_private.cnpj_alfanumerico_valido(matriz.cnpj)
        OR left(app_private.normalizar_cnpj_alfanumerico(filial.cnpj), 8)
          <> left(app_private.normalizar_cnpj_alfanumerico(matriz.cnpj), 8)
      )
  ) THEN
    RAISE EXCEPTION
      'Existem filiais com hierarquia ou CNPJ inconsistente; corrija-as antes da migracao alfanumerica.'
      USING ERRCODE = '23514';
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION app_private.validar_hierarquia_filial_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_matriz public.clientes%rowtype;
  v_cnpj_normalizado text;
  v_matriz_cnpj_normalizado text;
BEGIN
  IF NEW.matriz_cliente_id IS NULL THEN
    IF NEW.tipo_estabelecimento IS DISTINCT FROM 'Matriz'
       OR NEW.filial_ref IS NOT NULL THEN
      RAISE EXCEPTION 'Registro matriz não pode possuir referência de filial.'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.matriz_cliente_id IS NOT NULL THEN
      RAISE EXCEPTION 'Uma filial não pode ser convertida em matriz.'
        USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.clientes filial
      WHERE filial.empresa_id = NEW.empresa_id
        AND filial.matriz_cliente_id = NEW.id
    ) THEN
      v_cnpj_normalizado := app_private.normalizar_cnpj_alfanumerico(NEW.cnpj);
      IF NEW.tipo = 'PF'
         OR NOT app_private.cnpj_alfanumerico_valido(v_cnpj_normalizado) THEN
        RAISE EXCEPTION 'Matriz com filiais deve ser pessoa jurídica com CNPJ válido.'
          USING ERRCODE = '23514';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM public.clientes filial
        WHERE filial.empresa_id = NEW.empresa_id
          AND filial.matriz_cliente_id = NEW.id
          AND left(
            app_private.normalizar_cnpj_alfanumerico(filial.cnpj), 8
          ) <> left(v_cnpj_normalizado, 8)
      ) THEN
        RAISE EXCEPTION 'O CNPJ da matriz deve manter a mesma raiz das filiais.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id = NEW.matriz_cliente_id THEN
    RAISE EXCEPTION 'A filial não pode referenciar a si mesma como matriz.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.matriz_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Uma matriz não pode ser convertida em filial.'
      USING ERRCODE = '42501';
  END IF;

  NEW.filial_ref := lower(btrim(COALESCE(NEW.filial_ref, '')));
  IF NEW.tipo_estabelecimento IS DISTINCT FROM 'Filial'
     OR NEW.filial_ref !~ '^[a-z0-9][a-z0-9_-]{0,79}$' THEN
    RAISE EXCEPTION 'Referência ou tipo de estabelecimento da filial inválido.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.matriz_cliente_id IS NOT NULL
     AND NEW.matriz_cliente_id IS DISTINCT FROM OLD.matriz_cliente_id THEN
    RAISE EXCEPTION 'A filial não pode ser movida para outra matriz.'
      USING ERRCODE = '42501';
  END IF;

  SELECT matriz.*
  INTO v_matriz
  FROM public.clientes matriz
  WHERE matriz.empresa_id = NEW.empresa_id
    AND matriz.id = NEW.matriz_cliente_id
    AND matriz.matriz_cliente_id IS NULL
    AND matriz.tipo_estabelecimento = 'Matriz'
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A matriz da filial não pertence ao tenant ou não é matriz.'
      USING ERRCODE = '23503';
  END IF;

  v_cnpj_normalizado := app_private.normalizar_cnpj_alfanumerico(NEW.cnpj);
  v_matriz_cnpj_normalizado := app_private.normalizar_cnpj_alfanumerico(v_matriz.cnpj);
  IF NEW.tipo = 'PF'
     OR v_matriz.tipo = 'PF'
     OR NOT app_private.cnpj_alfanumerico_valido(v_cnpj_normalizado)
     OR NOT app_private.cnpj_alfanumerico_valido(v_matriz_cnpj_normalizado)
     OR left(v_cnpj_normalizado, 8) <> left(v_matriz_cnpj_normalizado, 8) THEN
    RAISE EXCEPTION 'Filial deve ser pessoa jurídica e compartilhar a raiz do CNPJ da matriz.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION app_private.validar_hierarquia_filial_cliente()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validar_hierarquia_filial_cliente
  ON public.clientes;
CREATE TRIGGER validar_hierarquia_filial_cliente
  BEFORE INSERT OR UPDATE OF
    empresa_id, matriz_cliente_id, filial_ref, tipo_estabelecimento, tipo, cnpj
  ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION app_private.validar_hierarquia_filial_cliente();

CREATE OR REPLACE FUNCTION public.salvar_filial_cliente_v1(
  p_matriz_id uuid,
  p_filial_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_matriz public.clientes%rowtype;
  v_filial public.clientes%rowtype;
  v_nome text := btrim(COALESCE(p_payload ->> 'nome', ''));
  v_cnpj text := btrim(COALESCE(p_payload ->> 'cnpj', ''));
  v_email text := btrim(COALESCE(p_payload ->> 'email', ''));
  v_telefone text := btrim(COALESCE(p_payload ->> 'telefone', ''));
  v_contato text := btrim(COALESCE(p_payload ->> 'contato', ''));
  v_endereco text := btrim(COALESCE(p_payload ->> 'endereco', ''));
  v_bairro text := btrim(COALESCE(p_payload ->> 'bairro', ''));
  v_cep text := btrim(COALESCE(p_payload ->> 'cep', ''));
  v_cidade text := btrim(COALESCE(p_payload ->> 'cidade', ''));
  v_uf text := upper(btrim(COALESCE(p_payload ->> 'uf', '')));
  v_filial_ref text := btrim(COALESCE(p_payload ->> 'filial_ref', ''));
  v_cnpj_snapshot jsonb := COALESCE(p_payload -> 'cnpj_lookup_snapshot', '{}'::jsonb);
  v_cnpj_normalizado text;
  v_matriz_cnpj_normalizado text;
  v_cep_numeros text;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL
     OR COALESCE(public.current_user_is_client_scoped(v_empresa_id), true)
     OR (
       p_filial_id IS NULL
       AND NOT COALESCE(public.current_user_has_permission(v_empresa_id, 'clientes:create'), false)
     )
     OR (
       p_filial_id IS NOT NULL
       AND NOT COALESCE(public.current_user_has_permission(v_empresa_id, 'clientes:update'), false)
     ) THEN
    RAISE EXCEPTION 'Filial não encontrada.' USING ERRCODE = '42501';
  END IF;

  IF p_matriz_id IS NULL
     OR pg_catalog.jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR pg_catalog.octet_length(p_payload::text) > 262144 THEN
    RAISE EXCEPTION 'Dados da filial inválidos.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_each(p_payload) AS campo(chave, valor)
    WHERE campo.chave <> ALL (ARRAY[
      'filial_ref', 'nome', 'cnpj', 'email', 'telefone', 'contato',
      'endereco', 'bairro', 'cep', 'cidade', 'uf', 'cnpj_lookup_snapshot'
    ]::text[])
    OR (
      campo.chave = 'cnpj_lookup_snapshot'
      AND (
        pg_catalog.jsonb_typeof(campo.valor) IS DISTINCT FROM 'object'
        OR pg_catalog.octet_length(campo.valor::text) > 196608
      )
    )
    OR (
      campo.chave <> 'cnpj_lookup_snapshot'
      AND pg_catalog.jsonb_typeof(campo.valor) IS DISTINCT FROM 'string'
    )
  ) THEN
    RAISE EXCEPTION 'Dados da filial inválidos.' USING ERRCODE = '22023';
  END IF;

  -- Mesma ordem de locks das demais operacoes de filial: tenant, matriz, linha.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text, 913331)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':' || p_matriz_id::text, 913332)
  );
  SELECT matriz.* INTO v_matriz
  FROM public.clientes matriz
  WHERE matriz.empresa_id = v_empresa_id
    AND matriz.id = p_matriz_id
    AND matriz.matriz_cliente_id IS NULL
    AND matriz.tipo_estabelecimento = 'Matriz'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matriz não encontrada.' USING ERRCODE = '42501';
  END IF;
  v_matriz_cnpj_normalizado := app_private.normalizar_cnpj_alfanumerico(v_matriz.cnpj);
  IF v_matriz.tipo = 'PF'
     OR NOT app_private.cnpj_alfanumerico_valido(v_matriz_cnpj_normalizado) THEN
    RAISE EXCEPTION 'A matriz deve ser pessoa jurídica com CNPJ válido para possuir filiais.'
      USING ERRCODE = '22023';
  END IF;

  IF p_filial_id IS NULL THEN
    IF p_expected_updated_at IS NOT NULL OR v_matriz.status <> 'Ativa' THEN
      RAISE EXCEPTION 'A matriz não aceita nova filial nesta operação.' USING ERRCODE = '40001';
    END IF;
  ELSE
    SELECT filial.* INTO v_filial
    FROM public.clientes filial
    WHERE filial.empresa_id = v_empresa_id
      AND filial.id = p_filial_id
      AND filial.matriz_cliente_id = p_matriz_id
      AND filial.tipo_estabelecimento = 'Filial'
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Filial não encontrada.' USING ERRCODE = '42501';
    END IF;
    IF p_expected_updated_at IS NULL
       OR v_filial.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Filial alterada por outro usuário.' USING ERRCODE = '40001';
    END IF;
    v_nome := CASE WHEN p_payload ? 'nome' THEN v_nome ELSE v_filial.nome END;
    v_cnpj := CASE WHEN p_payload ? 'cnpj' THEN v_cnpj ELSE v_filial.cnpj END;
    v_email := CASE WHEN p_payload ? 'email' THEN v_email ELSE v_filial.email END;
    v_telefone := CASE WHEN p_payload ? 'telefone' THEN v_telefone ELSE v_filial.telefone END;
    v_contato := CASE WHEN p_payload ? 'contato' THEN v_contato ELSE v_filial.contato END;
    v_endereco := CASE WHEN p_payload ? 'endereco' THEN v_endereco ELSE v_filial.endereco END;
    v_bairro := CASE WHEN p_payload ? 'bairro' THEN v_bairro ELSE COALESCE(v_filial.bairro, '') END;
    v_cep := CASE WHEN p_payload ? 'cep' THEN v_cep ELSE COALESCE(v_filial.cep, '') END;
    v_cidade := CASE WHEN p_payload ? 'cidade' THEN v_cidade ELSE COALESCE(v_filial.cidade, '') END;
    v_uf := CASE WHEN p_payload ? 'uf' THEN v_uf ELSE COALESCE(v_filial.uf, '') END;
    v_filial_ref := CASE
      WHEN p_payload ? 'filial_ref' THEN v_filial_ref ELSE v_filial.filial_ref
    END;
    v_cnpj_snapshot := CASE
      WHEN p_payload ? 'cnpj_lookup_snapshot' THEN v_cnpj_snapshot
      ELSE v_filial.cnpj_lookup_snapshot
    END;
  END IF;

  v_cnpj_normalizado := app_private.normalizar_cnpj_alfanumerico(v_cnpj);
  v_cep_numeros := pg_catalog.regexp_replace(v_cep, '[^0-9]', '', 'g');
  v_filial_ref := lower(btrim(CASE
    WHEN v_filial_ref <> '' THEN v_filial_ref
    ELSE 'cnpj-' || lower(v_cnpj_normalizado)
  END));
  v_filial_ref := trim(both '-' FROM pg_catalog.regexp_replace(
    v_filial_ref, '[^a-z0-9_-]+', '-', 'g'
  ));
  IF char_length(v_nome) NOT BETWEEN 2 AND 180
     OR NOT app_private.cnpj_alfanumerico_valido(v_cnpj_normalizado)
     OR char_length(v_email) > 255
     OR (v_email <> '' AND v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
     OR char_length(v_telefone) > 40
     OR char_length(v_contato) > 180
     OR char_length(v_endereco) > 500
     OR char_length(v_bairro) > 120
     OR char_length(v_cidade) > 120
     OR (v_uf <> '' AND v_uf !~ '^[A-Z]{2}$')
     OR (v_cep <> '' AND char_length(v_cep_numeros) <> 8)
     OR v_filial_ref !~ '^[a-z0-9][a-z0-9_-]{0,79}$'
     OR pg_catalog.jsonb_typeof(v_cnpj_snapshot) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Revise os dados cadastrais da filial.' USING ERRCODE = '22023';
  END IF;
  IF left(v_matriz_cnpj_normalizado, 8) <> left(v_cnpj_normalizado, 8) THEN
    RAISE EXCEPTION 'O CNPJ da filial não pertence à raiz da matriz.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.clientes existente
    WHERE existente.empresa_id = v_empresa_id
      AND existente.id IS DISTINCT FROM p_filial_id
      AND app_private.normalizar_cnpj_alfanumerico(existente.cnpj) = v_cnpj_normalizado
  ) THEN
    RAISE EXCEPTION 'Já existe um parceiro com este CNPJ.' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.clientes existente
    WHERE existente.empresa_id = v_empresa_id
      AND existente.matriz_cliente_id = p_matriz_id
      AND existente.id IS DISTINCT FROM p_filial_id
      AND lower(pg_catalog.btrim(existente.filial_ref)) = v_filial_ref
  ) THEN
    RAISE EXCEPTION 'Já existe uma filial com esta referência.' USING ERRCODE = '23505';
  END IF;

  IF p_filial_id IS NULL THEN
    INSERT INTO public.clientes AS filial (
      empresa_id, matriz_cliente_id, filial_ref, nome, razao_social, cnpj,
      tipo, categoria_cliente, tipo_estabelecimento, logo, status,
      email, telefone, endereco, cidade, uf, cep, bairro, contato,
      tipo_parceiro_id, tipo_empresa_id, tipo_empresa_catalogo_tipo,
      natureza_juridica_id, natureza_juridica_catalogo_tipo, modelos_ativos,
      cnpj_lookup_snapshot
    ) VALUES (
      v_empresa_id, p_matriz_id, v_filial_ref, v_nome,
      COALESCE(NULLIF(v_matriz.razao_social, ''), v_nome), v_cnpj,
      v_matriz.tipo, v_matriz.categoria_cliente, 'Filial', v_matriz.logo, 'Ativa',
      v_email, v_telefone, v_endereco, NULLIF(v_cidade, ''), NULLIF(v_uf, ''),
      NULLIF(v_cep, ''), NULLIF(v_bairro, ''), v_contato,
      v_matriz.tipo_parceiro_id, v_matriz.tipo_empresa_id,
      v_matriz.tipo_empresa_catalogo_tipo, v_matriz.natureza_juridica_id,
      v_matriz.natureza_juridica_catalogo_tipo, '{}'::text[], v_cnpj_snapshot
    ) RETURNING filial.* INTO v_filial;
  ELSE
    UPDATE public.clientes AS filial
    SET filial_ref = v_filial_ref,
        nome = v_nome,
        cnpj = v_cnpj,
        email = v_email,
        telefone = v_telefone,
        contato = v_contato,
        endereco = v_endereco,
        bairro = NULLIF(v_bairro, ''),
        cep = NULLIF(v_cep, ''),
        cidade = NULLIF(v_cidade, ''),
        uf = NULLIF(v_uf, ''),
        cnpj_lookup_snapshot = v_cnpj_snapshot
    WHERE filial.empresa_id = v_empresa_id
      AND filial.id = p_filial_id
      AND filial.matriz_cliente_id = p_matriz_id
    RETURNING filial.* INTO v_filial;
  END IF;
  RETURN pg_catalog.to_jsonb(v_filial);
END;
$function$;

REVOKE ALL ON FUNCTION public.salvar_filial_cliente_v1(uuid, uuid, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_filial_cliente_v1(uuid, uuid, jsonb, timestamptz)
  TO authenticated;

COMMIT;
