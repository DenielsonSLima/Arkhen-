-- Mantem as permissoes RTC nos perfis padrao, sem impedir que o gestor as
-- remova posteriormente pela matriz de acesso.

CREATE OR REPLACE FUNCTION public.aplicar_permissoes_reforma_perfil_padrao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_padrao text[];
BEGIN
  IF NEW.sistema = true AND NEW.codigo IN ('gestor', 'administrador', 'fiscal') THEN
    v_padrao := ARRAY['reforma-tributaria:view', 'reforma-tributaria:manage'];
    SELECT array_agg(DISTINCT permissao ORDER BY permissao)
    INTO NEW.permissoes
    FROM unnest(COALESCE(NEW.permissoes, '{}'::text[]) || v_padrao) permissao;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aplicar_permissoes_reforma_perfil_padrao
  ON public.configuracoes_perfis_acesso;
CREATE TRIGGER aplicar_permissoes_reforma_perfil_padrao
BEFORE INSERT ON public.configuracoes_perfis_acesso
FOR EACH ROW EXECUTE FUNCTION public.aplicar_permissoes_reforma_perfil_padrao();

UPDATE public.configuracoes_perfis_acesso perfil
SET permissoes = atualizadas.permissoes, updated_at = now()
FROM (
  SELECT p.id, array_agg(DISTINCT permissao ORDER BY permissao) AS permissoes
  FROM public.configuracoes_perfis_acesso p
  CROSS JOIN LATERAL unnest(
    COALESCE(p.permissoes, '{}'::text[]) ||
    ARRAY['reforma-tributaria:view', 'reforma-tributaria:manage']
  ) permissao
  WHERE p.sistema = true AND p.codigo IN ('gestor', 'administrador', 'fiscal')
  GROUP BY p.id
) atualizadas
WHERE perfil.id = atualizadas.id;

REVOKE ALL ON FUNCTION public.aplicar_permissoes_reforma_perfil_padrao() FROM PUBLIC;

-- O seed e chamado ao listar perfis. Metadados padrao podem ser atualizados,
-- mas a matriz de permissoes existente deve ser preservada para que revogacoes
-- feitas pelo gestor nao sejam reintroduzidas.
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
    ) VALUES (
      p_empresa_id, r.codigo, r.nome, r.descricao, r.permissoes, r.sistema, true, r.ordem, r.created_at
    )
    ON CONFLICT (empresa_id, codigo) WHERE codigo IS NOT NULL DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      sistema = true,
      ordem = EXCLUDED.ordem,
      updated_at = now();
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_perfis_acesso_empresa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_perfis_acesso_empresa(uuid) TO authenticated;
