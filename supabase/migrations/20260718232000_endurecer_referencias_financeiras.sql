-- Garante isolamento referencial entre tenants nas tabelas financeiras.
-- FKs simples validavam apenas o UUID, sem exigir a mesma empresa_id.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.financeiro_configuracoes f
    JOIN public.clientes c ON c.id = f.cliente_empresa_id
    WHERE c.empresa_id <> f.empresa_id
  ) OR EXISTS (
    SELECT 1 FROM public.financeiro_cobrancas f
    JOIN public.clientes c ON c.id = f.cliente_empresa_id
    WHERE c.empresa_id <> f.empresa_id
  ) OR EXISTS (
    SELECT 1 FROM public.financeiro_cobrancas f
    JOIN public.financeiro_configuracoes c ON c.id = f.contrato_id
    WHERE c.empresa_id <> f.empresa_id
  ) OR EXISTS (
    SELECT 1 FROM public.financeiro_lancamentos f
    JOIN public.clientes c ON c.id = f.cliente_empresa_id
    WHERE c.empresa_id <> f.empresa_id
  ) OR EXISTS (
    SELECT 1 FROM public.financeiro_lancamentos f
    JOIN public.configuracoes_contas_bancarias c ON c.id = f.conta_bancaria_id
    WHERE c.empresa_id <> f.empresa_id
  ) OR EXISTS (
    SELECT 1 FROM public.financeiro_cobrancas_integracoes f
    JOIN public.financeiro_cobrancas c ON c.id = f.cobranca_id
    WHERE c.empresa_id <> f.empresa_id
  ) OR EXISTS (
    SELECT 1 FROM public.financeiro_cobrancas cobranca
    JOIN public.financeiro_configuracoes contrato
      ON contrato.id = cobranca.contrato_id
     AND contrato.empresa_id = cobranca.empresa_id
    WHERE cobranca.cliente_empresa_id IS DISTINCT FROM contrato.cliente_empresa_id
  ) OR EXISTS (
    SELECT 1 FROM public.financeiro_lancamentos lancamento
    LEFT JOIN public.financeiro_cobrancas cobranca
      ON cobranca.id = lancamento.referencia_id
     AND cobranca.empresa_id = lancamento.empresa_id
    WHERE lancamento.origem = 'cobranca'
      AND (
        lancamento.referencia_id IS NULL
        OR cobranca.id IS NULL
        OR lancamento.cliente_empresa_id IS DISTINCT FROM cobranca.cliente_empresa_id
      )
  ) THEN
    RAISE EXCEPTION 'Existem vínculos financeiros entre empresas diferentes; corrija os dados antes da migration.';
  END IF;
END;
$$;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_id_empresa_id_key UNIQUE (id, empresa_id);
ALTER TABLE public.configuracoes_contas_bancarias
  ADD CONSTRAINT configuracoes_contas_bancarias_id_empresa_id_key UNIQUE (id, empresa_id);
ALTER TABLE public.financeiro_configuracoes
  ADD CONSTRAINT financeiro_configuracoes_id_empresa_id_key UNIQUE (id, empresa_id);
ALTER TABLE public.financeiro_cobrancas
  ADD CONSTRAINT financeiro_cobrancas_id_empresa_id_key UNIQUE (id, empresa_id);

ALTER TABLE public.financeiro_configuracoes
  DROP CONSTRAINT financeiro_configuracoes_cliente_empresa_id_fkey,
  ADD CONSTRAINT financeiro_configuracoes_cliente_tenant_fkey
    FOREIGN KEY (cliente_empresa_id, empresa_id)
    REFERENCES public.clientes (id, empresa_id)
    ON DELETE SET NULL (cliente_empresa_id);

ALTER TABLE public.financeiro_cobrancas
  DROP CONSTRAINT financeiro_cobrancas_cliente_empresa_id_fkey,
  DROP CONSTRAINT financeiro_cobrancas_contrato_id_fkey,
  ADD CONSTRAINT financeiro_cobrancas_cliente_tenant_fkey
    FOREIGN KEY (cliente_empresa_id, empresa_id)
    REFERENCES public.clientes (id, empresa_id)
    ON DELETE SET NULL (cliente_empresa_id),
  ADD CONSTRAINT financeiro_cobrancas_contrato_tenant_fkey
    FOREIGN KEY (contrato_id, empresa_id)
    REFERENCES public.financeiro_configuracoes (id, empresa_id)
    ON DELETE SET NULL (contrato_id);

ALTER TABLE public.financeiro_lancamentos
  DROP CONSTRAINT financeiro_lancamentos_cliente_empresa_id_fkey,
  DROP CONSTRAINT financeiro_lancamentos_conta_bancaria_id_fkey,
  ADD CONSTRAINT financeiro_lancamentos_cliente_tenant_fkey
    FOREIGN KEY (cliente_empresa_id, empresa_id)
    REFERENCES public.clientes (id, empresa_id)
    ON DELETE SET NULL (cliente_empresa_id),
  ADD CONSTRAINT financeiro_lancamentos_conta_tenant_fkey
    FOREIGN KEY (conta_bancaria_id, empresa_id)
    REFERENCES public.configuracoes_contas_bancarias (id, empresa_id)
    ON DELETE SET NULL (conta_bancaria_id);

ALTER TABLE public.financeiro_cobrancas_integracoes
  DROP CONSTRAINT financeiro_cobrancas_integracoes_cobranca_id_fkey,
  ADD CONSTRAINT financeiro_cobrancas_integracoes_cobranca_tenant_fkey
    FOREIGN KEY (cobranca_id, empresa_id)
    REFERENCES public.financeiro_cobrancas (id, empresa_id)
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS financeiro_cobrancas_integracoes_cobranca_id_idx
  ON public.financeiro_cobrancas_integracoes (cobranca_id);

CREATE OR REPLACE FUNCTION public.validar_consistencia_cobranca_financeira()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_contrato uuid;
BEGIN
  IF NEW.contrato_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT contrato.cliente_empresa_id
  INTO v_cliente_contrato
  FROM public.financeiro_configuracoes AS contrato
  WHERE contrato.id = NEW.contrato_id
    AND contrato.empresa_id = NEW.empresa_id;

  IF v_cliente_contrato IS DISTINCT FROM NEW.cliente_empresa_id THEN
    RAISE EXCEPTION 'O cliente da cobrança difere do cliente do contrato.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_referencia_lancamento_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cliente_cobranca uuid;
BEGIN
  IF NEW.origem <> 'cobranca' THEN
    RETURN NEW;
  END IF;
  IF NEW.referencia_id IS NULL THEN
    RAISE EXCEPTION 'Lançamento de cobrança exige referencia_id.'
      USING ERRCODE = '23503';
  END IF;

  SELECT cobranca.cliente_empresa_id
  INTO v_cliente_cobranca
  FROM public.financeiro_cobrancas AS cobranca
  WHERE cobranca.id = NEW.referencia_id
    AND cobranca.empresa_id = NEW.empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobrança de referência não pertence à empresa do lançamento.'
      USING ERRCODE = '23503';
  END IF;
  IF v_cliente_cobranca IS DISTINCT FROM NEW.cliente_empresa_id THEN
    RAISE EXCEPTION 'O cliente do lançamento difere do cliente da cobrança.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_consistencia_cobranca_financeira() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_referencia_lancamento_financeiro() FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER validar_consistencia_cobranca_financeira
AFTER INSERT OR UPDATE
ON public.financeiro_cobrancas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validar_consistencia_cobranca_financeira();

CREATE CONSTRAINT TRIGGER validar_referencia_lancamento_financeiro
AFTER INSERT OR UPDATE
ON public.financeiro_lancamentos
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validar_referencia_lancamento_financeiro();
