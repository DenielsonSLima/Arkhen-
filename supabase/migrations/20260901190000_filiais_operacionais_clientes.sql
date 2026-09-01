-- Filiais operacionais são registros-filhos de clientes. Elas reutilizam a
-- identidade cliente_id já consumida por rotinas, tarefas e acompanhamento,
-- mas não podem ser criadas ou movidas pela API direta de clientes.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS matriz_cliente_id uuid,
  ADD COLUMN IF NOT EXISTS filial_ref text;

-- Registros antigos marcados apenas como "Filial" não possuem vínculo confiável
-- com uma matriz. Eles continuam operacionais como matrizes independentes até
-- que uma filial real seja criada pela RPC com identidade própria.
UPDATE public.clientes
SET tipo_estabelecimento = 'Matriz'
WHERE tipo_estabelecimento = 'Filial'
  AND matriz_cliente_id IS NULL
  AND filial_ref IS NULL;

DO $migration$
BEGIN
  IF pg_catalog.to_regclass('public.clientes_empresa_id_id_uidx') IS NULL
     AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.clientes'::pg_catalog.regclass
      AND conname = 'clientes_empresa_id_id_unq'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_empresa_id_id_unq UNIQUE (empresa_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.clientes'::pg_catalog.regclass
      AND conname = 'clientes_matriz_cliente_tenant_fk'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_matriz_cliente_tenant_fk
      FOREIGN KEY (empresa_id, matriz_cliente_id)
      REFERENCES public.clientes (empresa_id, id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.clientes'::pg_catalog.regclass
      AND conname = 'clientes_matriz_filial_forma_check'
  ) THEN
    ALTER TABLE public.clientes
      ADD CONSTRAINT clientes_matriz_filial_forma_check
      CHECK (
        (
          matriz_cliente_id IS NULL
          AND filial_ref IS NULL
          AND tipo_estabelecimento = 'Matriz'
        )
        OR (
          matriz_cliente_id IS NOT NULL
          AND filial_ref IS NOT NULL
          AND tipo_estabelecimento = 'Filial'
        )
      ) NOT VALID;
  END IF;
END;
$migration$;

ALTER TABLE public.clientes
  VALIDATE CONSTRAINT clientes_matriz_filial_forma_check;

CREATE INDEX IF NOT EXISTS clientes_matriz_operacional_idx
  ON public.clientes (empresa_id, matriz_cliente_id)
  WHERE matriz_cliente_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_filial_ref_por_matriz_unq
  ON public.clientes (
    empresa_id,
    matriz_cliente_id,
    lower(btrim(filial_ref))
  )
  WHERE matriz_cliente_id IS NOT NULL;

-- A restrição física elimina a janela de concorrência entre cadastro de matriz,
-- filial e edições diretas. CNPJ incompleto continua permitido durante rascunhos.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clientes
    WHERE char_length(pg_catalog.regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g')) = 14
    GROUP BY empresa_id, pg_catalog.regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem CNPJs duplicados no tenant; corrija-os antes da migration de filiais.';
  END IF;
END;
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_cnpj_normalizado_por_empresa_unq
  ON public.clientes (
    empresa_id,
    (pg_catalog.regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g'))
  )
  WHERE char_length(
    pg_catalog.regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g')
  ) = 14;

COMMENT ON COLUMN public.clientes.matriz_cliente_id IS
  'Matriz do estabelecimento operacional. Nulo somente para registros matriz.';
COMMENT ON COLUMN public.clientes.filial_ref IS
  'Referência estável da filial, única por matriz e tenant.';

CREATE OR REPLACE FUNCTION app_private.validar_hierarquia_filial_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_matriz public.clientes%rowtype;
  v_cnpj_numeros text;
  v_matriz_cnpj_numeros text;
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
      v_cnpj_numeros := pg_catalog.regexp_replace(
        COALESCE(NEW.cnpj, ''), '[^0-9]', '', 'g'
      );
      IF NEW.tipo = 'PF' OR char_length(v_cnpj_numeros) <> 14 THEN
        RAISE EXCEPTION 'Matriz com filiais deve ser pessoa jurídica com CNPJ válido.'
          USING ERRCODE = '23514';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM public.clientes filial
        WHERE filial.empresa_id = NEW.empresa_id
          AND filial.matriz_cliente_id = NEW.id
          AND left(pg_catalog.regexp_replace(
            COALESCE(filial.cnpj, ''), '[^0-9]', '', 'g'
          ), 8) <> left(v_cnpj_numeros, 8)
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

  v_cnpj_numeros := pg_catalog.regexp_replace(
    COALESCE(NEW.cnpj, ''), '[^0-9]', '', 'g'
  );
  v_matriz_cnpj_numeros := pg_catalog.regexp_replace(
    COALESCE(v_matriz.cnpj, ''), '[^0-9]', '', 'g'
  );
  IF NEW.tipo = 'PF'
     OR v_matriz.tipo = 'PF'
     OR char_length(v_cnpj_numeros) <> 14
     OR char_length(v_matriz_cnpj_numeros) <> 14
     OR left(v_cnpj_numeros, 8) <> left(v_matriz_cnpj_numeros, 8) THEN
    RAISE EXCEPTION 'Filial deve ser pessoa jurídica e compartilhar a raiz do CNPJ da matriz.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

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

-- Uma autorização direta da matriz abrange suas filiais operacionais. Uma
-- autorização dada somente à filial continua restrita à própria filial.
CREATE OR REPLACE FUNCTION public.current_user_has_client_access(
  p_empresa_id uuid,
  p_cliente_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND p_empresa_id IS NOT NULL
    AND p_cliente_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.cliente_usuario_acessos acesso
      WHERE acesso.auth_user_id = auth.uid()
        AND acesso.empresa_id = p_empresa_id
        AND acesso.status = 'Ativo'
        AND (
          acesso.cliente_id = p_cliente_id
          OR EXISTS (
            SELECT 1
            FROM public.clientes alvo
            WHERE alvo.empresa_id = p_empresa_id
              AND alvo.id = p_cliente_id
              AND alvo.matriz_cliente_id = acesso.cliente_id
              AND alvo.tipo_estabelecimento = 'Filial'
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_client_access(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_client_access(uuid, uuid)
  TO authenticated;

-- Perfis cliente-escopados podem acessar uma filial apenas se tiverem acesso
-- direto à matriz; acesso a uma filial nunca amplia para matriz ou irmãs.
CREATE OR REPLACE FUNCTION public.current_user_can_access_client_row(
  p_empresa_id uuid,
  p_cliente_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    (p_empresa_id IS NULL AND p_cliente_id IS NULL)
    OR (
      p_empresa_id IS NOT NULL
      AND public.is_empresa_member(p_empresa_id)
      AND (
        NOT public.current_user_is_client_scoped(p_empresa_id)
        OR (
          p_cliente_id IS NOT NULL AND (
            public.current_user_has_client_access(p_empresa_id, p_cliente_id)
            OR EXISTS (
              SELECT 1
              FROM public.clientes alvo
              JOIN public.cliente_usuario_acessos acesso
                ON acesso.auth_user_id = auth.uid()
               AND acesso.empresa_id = alvo.empresa_id
               AND acesso.cliente_id = alvo.matriz_cliente_id
               AND acesso.status = 'Ativo'
              WHERE alvo.empresa_id = p_empresa_id
                AND alvo.id = p_cliente_id
                AND alvo.matriz_cliente_id IS NOT NULL
                AND alvo.tipo_estabelecimento = 'Filial'
            )
          )
        )
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_client_row(
  p_empresa_id uuid,
  p_cliente_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    (p_empresa_id IS NULL AND NULLIF(pg_catalog.btrim(p_cliente_id), '') IS NULL)
    OR (
      p_empresa_id IS NOT NULL
      AND public.is_empresa_member(p_empresa_id)
      AND (
        NOT public.current_user_is_client_scoped(p_empresa_id)
        OR EXISTS (
          SELECT 1
          FROM public.cliente_usuario_acessos acesso
          WHERE acesso.auth_user_id = auth.uid()
            AND acesso.empresa_id = p_empresa_id
            AND acesso.status = 'Ativo'
            AND (
              acesso.cliente_id::text = NULLIF(pg_catalog.btrim(p_cliente_id), '')
              OR EXISTS (
                SELECT 1
                FROM public.clientes alvo
                WHERE alvo.empresa_id = p_empresa_id
                  AND alvo.id::text = NULLIF(pg_catalog.btrim(p_cliente_id), '')
                  AND alvo.matriz_cliente_id = acesso.cliente_id
                  AND alvo.tipo_estabelecimento = 'Filial'
              )
            )
        )
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_access_client_row(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_can_access_client_row(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_client_row(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_client_row(uuid, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_can_access_cliente_operacional(
  p_empresa_id uuid,
  p_cliente_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    public.current_user_can_access_client_row(p_empresa_id, p_cliente_id), false
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_access_cliente_operacional(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_cliente_operacional(uuid, uuid)
  TO authenticated;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Substitui o guard histórico de leitura, que reconhecia apenas acesso direto
-- e, por ser RESTRICTIVE, impediria a matriz autorizada de enxergar filiais.
DROP POLICY IF EXISTS clientes_isolamento_scoped_select ON public.clientes;
CREATE POLICY clientes_isolamento_scoped_select ON public.clientes
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    NOT public.current_user_is_client_scoped(empresa_id)
    OR public.current_user_can_access_cliente_operacional(empresa_id, id)
  );

-- Esta precisa ser restritiva: há políticas permissivas de tenant históricas.
DROP POLICY IF EXISTS clientes_select_operacional_scope ON public.clientes;
CREATE POLICY clientes_select_operacional_scope ON public.clientes
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.current_user_can_access_cliente_operacional(empresa_id, id));

-- RLS combina permissivas por OR e restritivas por AND: esta concede o caminho
-- de leitura aos perfis escopados; a anterior limita políticas históricas.
DROP POLICY IF EXISTS clientes_select_operacional_allow ON public.clientes;
CREATE POLICY clientes_select_operacional_allow ON public.clientes
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.current_user_is_client_scoped(empresa_id)
    AND public.current_user_can_access_cliente_operacional(empresa_id, id)
  );

-- Filiais passam exclusivamente pelas RPCs abaixo; as políticas diretas
-- permanecem disponíveis para cadastros matriz já existentes.
DROP POLICY IF EXISTS clientes_insert_permission ON public.clientes;
CREATE POLICY clientes_insert_permission ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'clientes:create')
    AND matriz_cliente_id IS NULL
    AND filial_ref IS NULL
    AND tipo_estabelecimento = 'Matriz'
  );

DROP POLICY IF EXISTS clientes_update_permission ON public.clientes;
CREATE POLICY clientes_update_permission ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'clientes:update')
    AND matriz_cliente_id IS NULL
  )
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'clientes:update')
    AND matriz_cliente_id IS NULL
    AND filial_ref IS NULL
    AND tipo_estabelecimento = 'Matriz'
  );

DROP POLICY IF EXISTS clientes_delete_permission ON public.clientes;
CREATE POLICY clientes_delete_permission ON public.clientes
  FOR DELETE TO authenticated
  USING (public.current_user_has_permission(empresa_id, 'clientes:delete') AND matriz_cliente_id IS NULL);

-- Mesmo com políticas permissivas históricas, só matrizes podem ser alteradas
-- pela API direta. SECURITY DEFINER das RPCs é o caminho de filiais.
DROP POLICY IF EXISTS clientes_insert_apenas_matriz ON public.clientes;
CREATE POLICY clientes_insert_apenas_matriz ON public.clientes
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'clientes:create')
    AND matriz_cliente_id IS NULL AND filial_ref IS NULL AND tipo_estabelecimento = 'Matriz'
  );

DROP POLICY IF EXISTS clientes_update_apenas_matriz ON public.clientes;
CREATE POLICY clientes_update_apenas_matriz ON public.clientes
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'clientes:update')
    AND matriz_cliente_id IS NULL
  )
  WITH CHECK (
    public.current_user_has_permission(empresa_id, 'clientes:update')
    AND matriz_cliente_id IS NULL AND filial_ref IS NULL AND tipo_estabelecimento = 'Matriz'
  );

DROP POLICY IF EXISTS clientes_delete_apenas_matriz ON public.clientes;
CREATE POLICY clientes_delete_apenas_matriz ON public.clientes
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    public.current_user_has_permission(empresa_id, 'clientes:delete')
    AND matriz_cliente_id IS NULL
  );
