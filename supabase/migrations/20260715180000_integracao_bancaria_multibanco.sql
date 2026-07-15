-- Base multi-banco: estado seguro, provedor ativo, eventos Inter e cobrancas genericas.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
ALTER TABLE public.configuracoes_integracao_bancaria
  ADD COLUMN IF NOT EXISTS status varchar(24) NOT NULL DEFAULT 'nao_configurado',
  ADD COLUMN IF NOT EXISTS modulos jsonb NOT NULL DEFAULT '{"boleto":true,"pix":true,"webhook":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS webhook_route_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS ultimo_erro text,
  ADD COLUMN IF NOT EXISTS validado_em timestamptz;
ALTER TABLE public.configuracoes_integracao_bancaria
  DROP CONSTRAINT IF EXISTS configuracoes_integracao_bancaria_status_check;
ALTER TABLE public.configuracoes_integracao_bancaria
  ADD CONSTRAINT configuracoes_integracao_bancaria_status_check
  CHECK (status IN ('nao_configurado', 'em_validacao', 'ativo', 'erro'));
ALTER TABLE public.configuracoes_integracao_bancaria
  DROP CONSTRAINT IF EXISTS configuracoes_integracao_bancaria_modulos_check;
ALTER TABLE public.configuracoes_integracao_bancaria
  ADD CONSTRAINT configuracoes_integracao_bancaria_modulos_check
  CHECK (jsonb_typeof(modulos) = 'object');
WITH duplicados AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY empresa_id
           ORDER BY (status = 'ativo') DESC, updated_at DESC, created_at DESC, id
         ) AS ordem
  FROM public.configuracoes_integracao_bancaria
  WHERE ativo = true
)
UPDATE public.configuracoes_integracao_bancaria c
SET ativo = false,
    updated_at = now()
FROM duplicados d
WHERE c.id = d.id
  AND d.ordem > 1;
CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_integracao_bancaria_empresa_ativa_idx
  ON public.configuracoes_integracao_bancaria (empresa_id)
  WHERE ativo = true;
CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_integracao_bancaria_webhook_route_idx
  ON public.configuracoes_integracao_bancaria (webhook_route_id);
UPDATE public.configuracoes_integracao_bancaria
SET status = CASE WHEN ativo THEN 'ativo' ELSE status END,
    modulos = CASE
      WHEN provedor = 'asaas' THEN jsonb_build_object(
        'boleto', coalesce((configuracao->'environments'->coalesce(configuracao->>'activeEnvironment', 'homologacao')->>'aceitaBoleto')::boolean, true),
        'pix', coalesce((configuracao->'environments'->coalesce(configuracao->>'activeEnvironment', 'homologacao')->>'aceitaPix')::boolean, true),
        'webhook', true,
        'cartao', coalesce((configuracao->'environments'->coalesce(configuracao->>'activeEnvironment', 'homologacao')->>'aceitaCartao')::boolean, false),
        'checkout', coalesce((configuracao->'environments'->coalesce(configuracao->>'activeEnvironment', 'homologacao')->>'checkoutAtivo')::boolean, false)
      )
      ELSE modulos
    END
WHERE provedor = 'asaas';
CREATE TABLE IF NOT EXISTS public.inter_webhook_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  integracao_id uuid REFERENCES public.configuracoes_integracao_bancaria(id) ON DELETE SET NULL,
  ambiente varchar(20) NOT NULL CHECK (ambiente IN ('producao', 'homologacao')),
  external_event_id text NOT NULL,
  event_type text NOT NULL DEFAULT 'UNKNOWN',
  conta_corrente text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido', 'duplicado', 'processando', 'processado', 'erro')),
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  erro text,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, ambiente, external_event_id)
);
CREATE INDEX IF NOT EXISTS inter_webhook_eventos_empresa_recebido_idx
  ON public.inter_webhook_eventos (empresa_id, recebido_em DESC);
CREATE INDEX IF NOT EXISTS inter_webhook_eventos_pendentes_idx
  ON public.inter_webhook_eventos (status, recebido_em)
  WHERE status IN ('recebido', 'erro');
CREATE TABLE IF NOT EXISTS public.financeiro_cobrancas_integracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cobranca_id uuid NOT NULL REFERENCES public.financeiro_cobrancas(id) ON DELETE CASCADE,
  provedor varchar(60) NOT NULL CHECK (provedor IN ('asaas', 'inter')),
  ambiente varchar(20) NOT NULL CHECK (ambiente IN ('producao', 'homologacao')),
  external_id text,
  tipo varchar(24) NOT NULL DEFAULT 'boleto'
    CHECK (tipo IN ('boleto', 'pix', 'bolepix', 'cartao', 'checkout', 'outro')),
  status text,
  boleto_url text,
  pix_copia_cola text,
  pix_qr_code text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sincronizado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, cobranca_id, provedor, ambiente),
  UNIQUE (empresa_id, provedor, ambiente, external_id)
);
CREATE INDEX IF NOT EXISTS financeiro_cobrancas_integracoes_cobranca_idx
  ON public.financeiro_cobrancas_integracoes (empresa_id, cobranca_id);
CREATE INDEX IF NOT EXISTS financeiro_cobrancas_integracoes_external_idx
  ON public.financeiro_cobrancas_integracoes (empresa_id, provedor, ambiente, external_id)
  WHERE external_id IS NOT NULL;
INSERT INTO public.financeiro_cobrancas_integracoes (
  empresa_id, cobranca_id, provedor, ambiente, external_id, tipo, status,
  boleto_url, payload, sincronizado_em
)
SELECT fc.empresa_id,
       fc.id,
       'asaas',
       CASE WHEN fc.asaas_ambiente = 'producao' THEN 'producao' ELSE 'homologacao' END,
       fc.asaas_cobranca_id,
       CASE
         WHEN upper(coalesce(fc.asaas_billing_type, fc.meio_pagamento, '')) = 'PIX' THEN 'pix'
         ELSE 'boleto'
       END,
       fc.asaas_status,
       coalesce(fc.asaas_bank_slip_url, fc.asaas_boleto_url, fc.asaas_invoice_url),
       coalesce(fc.asaas_payload, '{}'::jsonb),
       fc.asaas_synced_at
FROM public.financeiro_cobrancas fc
WHERE NULLIF(fc.asaas_cobranca_id, '') IS NOT NULL
ON CONFLICT (empresa_id, cobranca_id, provedor, ambiente) DO NOTHING;
ALTER TABLE public.inter_webhook_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_cobrancas_integracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inter_webhook_eventos_tenant_select ON public.inter_webhook_eventos;
DROP POLICY IF EXISTS financeiro_cobrancas_integracoes_tenant_select ON public.financeiro_cobrancas_integracoes;
CREATE POLICY financeiro_cobrancas_integracoes_tenant_select
  ON public.financeiro_cobrancas_integracoes FOR SELECT TO authenticated
  USING (public.is_empresa_member(empresa_id));
DROP TRIGGER IF EXISTS set_inter_webhook_eventos_updated_at ON public.inter_webhook_eventos;
CREATE TRIGGER set_inter_webhook_eventos_updated_at
  BEFORE UPDATE ON public.inter_webhook_eventos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS set_financeiro_cobrancas_integracoes_updated_at ON public.financeiro_cobrancas_integracoes;
CREATE TRIGGER set_financeiro_cobrancas_integracoes_updated_at
  BEFORE UPDATE ON public.financeiro_cobrancas_integracoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
REVOKE ALL ON public.configuracoes_integracao_bancaria FROM anon, authenticated;
GRANT SELECT (
  id, empresa_id, provedor, ambiente, ativo, status, modulos, webhook_route_id,
  ultimo_erro, validado_em, created_at, updated_at
) ON public.configuracoes_integracao_bancaria TO authenticated;
GRANT ALL ON public.configuracoes_integracao_bancaria TO service_role;
REVOKE ALL ON public.inter_webhook_eventos FROM anon, authenticated;
GRANT ALL ON public.inter_webhook_eventos TO service_role;
REVOKE ALL ON public.financeiro_cobrancas_integracoes FROM anon, authenticated;
GRANT SELECT (
  id, empresa_id, cobranca_id, provedor, ambiente, external_id, tipo, status,
  boleto_url, pix_copia_cola, pix_qr_code, sincronizado_em, created_at, updated_at
) ON public.financeiro_cobrancas_integracoes TO authenticated;
GRANT ALL ON public.financeiro_cobrancas_integracoes TO service_role;
ALTER TABLE public.configuracoes_integracao_bancaria REPLICA IDENTITY DEFAULT;
ALTER TABLE public.financeiro_cobrancas_integracoes REPLICA IDENTITY DEFAULT;
ALTER TABLE public.inter_webhook_eventos REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'configuracoes_integracao_bancaria'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_integracao_bancaria (
        id, empresa_id, provedor, ambiente, ativo, status, modulos, webhook_route_id,
        ultimo_erro, validado_em, created_at, updated_at
      );
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'financeiro_cobrancas_integracoes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_cobrancas_integracoes (
        id, empresa_id, cobranca_id, provedor, ambiente, external_id, tipo, status,
        boleto_url, pix_copia_cola, pix_qr_code, sincronizado_em, created_at, updated_at
      );
    END IF;
  END IF;
END;
$$;
