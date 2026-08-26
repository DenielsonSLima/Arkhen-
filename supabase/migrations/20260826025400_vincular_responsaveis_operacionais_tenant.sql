-- Faz o responsavel operacional pertencer ao mesmo tenant da rotina/tarefa e
-- deriva nome/Auth do cadastro de usuario, sem confiar no payload do cliente.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.atividades_rotinas rotina
    LEFT JOIN public.configuracoes_usuarios usuario
      ON usuario.id = rotina.responsavel_config_usuario_id
     AND usuario.empresa_id = rotina.empresa_id
    WHERE rotina.responsavel_config_usuario_id IS NOT NULL
      AND usuario.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.atividades_tarefas tarefa
    LEFT JOIN public.configuracoes_usuarios usuario
      ON usuario.id = tarefa.responsavel_config_usuario_id
     AND usuario.empresa_id = tarefa.empresa_id
    WHERE tarefa.responsavel_config_usuario_id IS NOT NULL
      AND usuario.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.agenda_responsaveis responsavel
    LEFT JOIN public.configuracoes_usuarios usuario
      ON usuario.id = responsavel.config_usuario_id
     AND usuario.empresa_id = responsavel.empresa_id
    WHERE responsavel.config_usuario_id IS NOT NULL
      AND usuario.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Existem responsáveis operacionais vinculados a outro tenant; corrija antes da migration.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_usuarios_id_empresa_unique
  ON public.configuracoes_usuarios (id, empresa_id);

DO $$
DECLARE
  v_table regclass;
  v_column text;
  v_constraint record;
BEGIN
  FOR v_table, v_column IN
    SELECT * FROM (VALUES
      ('public.atividades_rotinas'::regclass, 'responsavel_config_usuario_id'::text),
      ('public.atividades_tarefas'::regclass, 'responsavel_config_usuario_id'::text),
      ('public.agenda_responsaveis'::regclass, 'config_usuario_id'::text)
    ) references_to_replace
  LOOP
    FOR v_constraint IN
      SELECT constraint_row.conname
      FROM pg_constraint constraint_row
      WHERE constraint_row.conrelid = v_table
        AND constraint_row.confrelid = 'public.configuracoes_usuarios'::regclass
        AND constraint_row.contype = 'f'
        AND EXISTS (
          SELECT 1
          FROM unnest(constraint_row.conkey) key_column(attnum)
          JOIN pg_attribute attribute_row
            ON attribute_row.attrelid = constraint_row.conrelid
           AND attribute_row.attnum = key_column.attnum
          WHERE attribute_row.attname = v_column
        )
    LOOP
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v_table, v_constraint.conname);
    END LOOP;
  END LOOP;
END;
$$;

ALTER TABLE public.atividades_rotinas
  ADD CONSTRAINT atividades_rotinas_responsavel_tenant_fkey
  FOREIGN KEY (responsavel_config_usuario_id, empresa_id)
  REFERENCES public.configuracoes_usuarios (id, empresa_id)
  ON DELETE SET NULL (responsavel_config_usuario_id);

ALTER TABLE public.atividades_tarefas
  ADD CONSTRAINT atividades_tarefas_responsavel_tenant_fkey
  FOREIGN KEY (responsavel_config_usuario_id, empresa_id)
  REFERENCES public.configuracoes_usuarios (id, empresa_id)
  ON DELETE SET NULL (responsavel_config_usuario_id);

ALTER TABLE public.agenda_responsaveis
  ADD CONSTRAINT agenda_responsaveis_config_usuario_tenant_fkey
  FOREIGN KEY (config_usuario_id, empresa_id)
  REFERENCES public.configuracoes_usuarios (id, empresa_id)
  ON DELETE SET NULL (config_usuario_id);

CREATE OR REPLACE FUNCTION public.derivar_responsavel_atividade_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usuario public.configuracoes_usuarios%ROWTYPE;
BEGIN
  IF NEW.responsavel_config_usuario_id IS NULL THEN
    -- ON DELETE SET NULL da FK deve preservar o nome histórico sem manter um
    -- auth_user_id órfão. A mesma regra torna a desvinculação explícita segura.
    IF TG_OP = 'UPDATE'
       AND OLD.responsavel_config_usuario_id IS NOT NULL THEN
      NEW.responsavel_user_id := NULL;
      NEW.responsavel_nome := OLD.responsavel_nome;
      RETURN NEW;
    END IF;
    IF NEW.responsavel_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Selecione um responsável cadastrado na empresa.'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT usuario.*
  INTO v_usuario
  FROM public.configuracoes_usuarios usuario
  WHERE usuario.id = NEW.responsavel_config_usuario_id
    AND usuario.empresa_id = NEW.empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Responsável não pertence à empresa ativa.'
      USING ERRCODE = '23503';
  END IF;

  NEW.responsavel_user_id := v_usuario.auth_user_id;
  NEW.responsavel_nome := v_usuario.nome;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.derivar_responsavel_atividade_tenant()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS derivar_responsavel_rotina_insert
  ON public.atividades_rotinas;
DROP TRIGGER IF EXISTS derivar_responsavel_rotina_update
  ON public.atividades_rotinas;
CREATE TRIGGER derivar_responsavel_rotina_insert
  BEFORE INSERT ON public.atividades_rotinas
  FOR EACH ROW EXECUTE FUNCTION public.derivar_responsavel_atividade_tenant();
CREATE TRIGGER derivar_responsavel_rotina_update
  BEFORE UPDATE OF empresa_id, responsavel_config_usuario_id,
    responsavel_user_id, responsavel_nome
  ON public.atividades_rotinas
  FOR EACH ROW EXECUTE FUNCTION public.derivar_responsavel_atividade_tenant();

DROP TRIGGER IF EXISTS derivar_responsavel_tarefa_insert
  ON public.atividades_tarefas;
DROP TRIGGER IF EXISTS derivar_responsavel_tarefa_update
  ON public.atividades_tarefas;
CREATE TRIGGER derivar_responsavel_tarefa_insert
  BEFORE INSERT ON public.atividades_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.derivar_responsavel_atividade_tenant();
CREATE TRIGGER derivar_responsavel_tarefa_update
  BEFORE UPDATE OF empresa_id, responsavel_config_usuario_id,
    responsavel_user_id, responsavel_nome
  ON public.atividades_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.derivar_responsavel_atividade_tenant();

UPDATE public.atividades_rotinas rotina
SET responsavel_user_id = usuario.auth_user_id,
    responsavel_nome = usuario.nome
FROM public.configuracoes_usuarios usuario
WHERE usuario.id = rotina.responsavel_config_usuario_id
  AND usuario.empresa_id = rotina.empresa_id
  AND (
    rotina.responsavel_user_id IS DISTINCT FROM usuario.auth_user_id
    OR rotina.responsavel_nome IS DISTINCT FROM usuario.nome
  );

UPDATE public.atividades_tarefas tarefa
SET responsavel_user_id = usuario.auth_user_id,
    responsavel_nome = usuario.nome
FROM public.configuracoes_usuarios usuario
WHERE usuario.id = tarefa.responsavel_config_usuario_id
  AND usuario.empresa_id = tarefa.empresa_id
  AND (
    tarefa.responsavel_user_id IS DISTINCT FROM usuario.auth_user_id
    OR tarefa.responsavel_nome IS DISTINCT FROM usuario.nome
  );

COMMIT;
