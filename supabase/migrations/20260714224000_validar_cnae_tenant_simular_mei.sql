-- Torna o catálogo CNAE da empresa a fonte autoritativa para a simulação MEI.
-- A implementação anterior é preservada integralmente para manter cálculos e
-- validações dos parâmetros tributários versionados.

ALTER FUNCTION public.simular_mei(jsonb)
  RENAME TO simular_mei_calculo_versionado;

-- Impede que clientes autenticados contornem a validação do catálogo chamando
-- diretamente a implementação preservada.
REVOKE ALL ON FUNCTION public.simular_mei_calculo_versionado(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.simular_mei(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_tipo text;
  v_ocupacao text;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada.';
  END IF;

  IF jsonb_typeof(COALESCE(p, '{}'::jsonb)) <> 'object'
     OR octet_length(COALESCE(p, '{}'::jsonb)::text) > 65536 THEN
    RAISE EXCEPTION 'Entrada inválida ou muito grande.';
  END IF;

  v_tipo := COALESCE(NULLIF(p ->> 'tipoMei', ''), 'normal');
  IF v_tipo NOT IN ('normal', 'caminhoneiro') THEN
    RAISE EXCEPTION 'Tipo de MEI inválido.';
  END IF;

  v_ocupacao := regexp_replace(
    COALESCE(p ->> 'ocupacaoCodigo', ''),
    '[^0-9]',
    '',
    'g'
  );

  IF v_ocupacao = '' THEN
    RAISE EXCEPTION 'Selecione um CNAE permitido no catálogo da empresa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.parametrizacao_cnaes AS c
    WHERE c.empresa_id = v_empresa_id
      AND regexp_replace(c.codigo, '[^0-9]', '', 'g') = v_ocupacao
      AND c.ativo = true
      AND c.mei_permitido = true
      AND c.mei_tipo = v_tipo
  ) THEN
    RAISE EXCEPTION 'CNAE não disponível para este tipo de MEI no catálogo ativo da empresa.';
  END IF;

  RETURN public.simular_mei_calculo_versionado(p);
END;
$$;

REVOKE ALL ON FUNCTION public.simular_mei(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simular_mei(jsonb) TO authenticated;

COMMENT ON FUNCTION public.simular_mei(jsonb) IS
  'Simula o MEI após validar o CNAE no catálogo ativo e isolado da empresa autenticada; o cálculo interno mantém os parâmetros tributários versionados.';

COMMENT ON FUNCTION public.simular_mei_calculo_versionado(jsonb) IS
  'Implementação interna da simulação MEI; acesso direto revogado para exigir a validação autoritativa do catálogo CNAE por tenant.';
