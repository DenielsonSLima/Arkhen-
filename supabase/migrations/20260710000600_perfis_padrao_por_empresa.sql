CREATE OR REPLACE FUNCTION public.seed_perfis_acesso_empresa(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
BEGIN
  IF NOT public.is_empresa_member(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso nao autorizado.';
  END IF;

  FOR r IN SELECT * FROM public.perfis_acesso_padrao()
  LOOP
    INSERT INTO public.configuracoes_perfis_acesso (
      empresa_id, codigo, nome, descricao, permissoes, sistema, ativo, ordem, created_at
    )
    VALUES (
      p_empresa_id, r.codigo, r.nome, r.descricao, r.permissoes, r.sistema, true, r.ordem, r.created_at
    )
    ON CONFLICT (empresa_id, codigo) WHERE codigo IS NOT NULL DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      permissoes = EXCLUDED.permissoes,
      sistema = true,
      ordem = EXCLUDED.ordem,
      updated_at = now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_perfis_acesso_empresa_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM public.perfis_acesso_padrao()
  LOOP
    INSERT INTO public.configuracoes_perfis_acesso (
      empresa_id, codigo, nome, descricao, permissoes, sistema, ativo, ordem, created_at
    )
    VALUES (
      NEW.id, r.codigo, r.nome, r.descricao, r.permissoes, r.sistema, true, r.ordem, r.created_at
    )
    ON CONFLICT (empresa_id, codigo) WHERE codigo IS NOT NULL DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      permissoes = EXCLUDED.permissoes,
      sistema = true,
      ordem = EXCLUDED.ordem,
      updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_perfis_acesso_after_empresa_insert ON public.empresas;
CREATE TRIGGER seed_perfis_acesso_after_empresa_insert
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.seed_perfis_acesso_empresa_trigger();

DO $$
DECLARE
  e record;
  r record;
BEGIN
  FOR e IN SELECT id FROM public.empresas
  LOOP
    FOR r IN SELECT * FROM public.perfis_acesso_padrao()
    LOOP
      INSERT INTO public.configuracoes_perfis_acesso (
        empresa_id, codigo, nome, descricao, permissoes, sistema, ativo, ordem, created_at
      )
      VALUES (
        e.id, r.codigo, r.nome, r.descricao, r.permissoes, r.sistema, true, r.ordem, r.created_at
      )
      ON CONFLICT (empresa_id, codigo) WHERE codigo IS NOT NULL DO UPDATE SET
        nome = EXCLUDED.nome,
        descricao = EXCLUDED.descricao,
        permissoes = EXCLUDED.permissoes,
        sistema = true,
        ordem = EXCLUDED.ordem,
        updated_at = now();
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.desativar_configuracoes_perfil_acesso(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  UPDATE public.configuracoes_perfis_acesso
  SET ativo = false, updated_at = now()
  WHERE id = p_id
    AND empresa_id = v_empresa_id;

  RETURN FOUND;
END;
$$;
