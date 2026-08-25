-- Persiste a altura configurada da logo da empresa e mantém o ajuste isolado por tenant.

ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS logo_tamanho integer;

UPDATE public.configuracoes_empresa
SET logo_tamanho = 80
WHERE logo_tamanho IS NULL
   OR logo_tamanho < 30
   OR logo_tamanho > 240;

ALTER TABLE public.configuracoes_empresa
  ALTER COLUMN logo_tamanho SET DEFAULT 80,
  ALTER COLUMN logo_tamanho SET NOT NULL;

ALTER TABLE public.configuracoes_empresa
  DROP CONSTRAINT IF EXISTS configuracoes_empresa_logo_tamanho_check;

ALTER TABLE public.configuracoes_empresa
  ADD CONSTRAINT configuracoes_empresa_logo_tamanho_check
  CHECK (logo_tamanho BETWEEN 30 AND 240);

CREATE OR REPLACE FUNCTION public.upsert_configuracoes_empresa(p_payload jsonb)
RETURNS public.configuracoes_empresa
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_row public.configuracoes_empresa;
  v_logo_tamanho integer := LEAST(
    240,
    GREATEST(30, COALESCE(NULLIF(p_payload->>'logo_tamanho', '')::integer, 80))
  );
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  INSERT INTO public.configuracoes_empresa (
    empresa_id, razao_social, nome_fantasia, cnpj, inscricao_estadual,
    email, telefone, cep, endereco, numero, cidade, estado, logo_url, logo_tamanho
  )
  VALUES (
    v_empresa_id,
    COALESCE(p_payload->>'razao_social', ''),
    COALESCE(p_payload->>'nome_fantasia', ''),
    COALESCE(p_payload->>'cnpj', ''),
    COALESCE(p_payload->>'inscricao_estadual', ''),
    COALESCE(p_payload->>'email', ''),
    COALESCE(p_payload->>'telefone', ''),
    COALESCE(p_payload->>'cep', ''),
    COALESCE(p_payload->>'endereco', ''),
    COALESCE(p_payload->>'numero', ''),
    COALESCE(p_payload->>'cidade', ''),
    COALESCE(p_payload->>'estado', ''),
    NULLIF(p_payload->>'logo_url', ''),
    v_logo_tamanho
  )
  ON CONFLICT (empresa_id) DO UPDATE SET
    razao_social = EXCLUDED.razao_social,
    nome_fantasia = EXCLUDED.nome_fantasia,
    cnpj = EXCLUDED.cnpj,
    inscricao_estadual = EXCLUDED.inscricao_estadual,
    email = EXCLUDED.email,
    telefone = EXCLUDED.telefone,
    cep = EXCLUDED.cep,
    endereco = EXCLUDED.endereco,
    numero = EXCLUDED.numero,
    cidade = EXCLUDED.cidade,
    estado = EXCLUDED.estado,
    logo_url = EXCLUDED.logo_url,
    logo_tamanho = EXCLUDED.logo_tamanho,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_configuracoes_empresa(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_configuracoes_empresa(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.upsert_configuracoes_empresa(jsonb) TO authenticated;
