-- A listagem chama este seed. Evitar UPDATE sem mudanca impede que o
-- Realtime invalide a mesma consulta indefinidamente.
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
    INSERT INTO public.configuracoes_perfis_acesso AS atual (
      empresa_id, codigo, nome, descricao, permissoes, sistema, ativo, ordem, created_at
    ) VALUES (
      p_empresa_id, r.codigo, r.nome, r.descricao, r.permissoes, r.sistema, true, r.ordem, r.created_at
    )
    ON CONFLICT (empresa_id, codigo) WHERE codigo IS NOT NULL DO UPDATE SET
      nome = EXCLUDED.nome,
      descricao = EXCLUDED.descricao,
      sistema = true,
      ordem = EXCLUDED.ordem,
      updated_at = now()
    WHERE (atual.nome, atual.descricao, atual.sistema, atual.ordem)
      IS DISTINCT FROM (EXCLUDED.nome, EXCLUDED.descricao, true, EXCLUDED.ordem);
    -- Permissoes e estado ativo existentes continuam sob controle do gestor.
  END LOOP;
END;
$$;
