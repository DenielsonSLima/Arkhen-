-- Migra financeiro/faturamento para dados reais consumidos pelo front.
-- Regras de negocio e agregacoes ficam no banco/RPC, mantendo a UI sem calculos financeiros.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.financeiro_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_empresa_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  descricao_servico text NOT NULL DEFAULT 'Honorarios contabeis',
  valor_mensal numeric(15,2) NOT NULL CHECK (valor_mensal >= 0),
  dia_vencimento integer NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 28),
  emissao_automatica_nfse boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financeiro_cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.financeiro_configuracoes(id) ON DELETE SET NULL,
  cliente_empresa_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT 'Cobranca de honorarios',
  categoria text NOT NULL DEFAULT 'Faturamento',
  valor numeric(15,2) NOT NULL CHECK (valor >= 0),
  data_vencimento date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Vencido', 'Cancelado')),
  meio_pagamento varchar(20) NOT NULL DEFAULT 'Boleto' CHECK (meio_pagamento IN ('Pix', 'Boleto', 'Ambos')),
  asaas_cobranca_id varchar(100),
  asaas_nfse_id varchar(100),
  asaas_boleto_url text,
  data_pagamento timestamptz,
  data_cancelamento timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  conta_bancaria_id uuid REFERENCES public.configuracoes_contas_bancarias(id) ON DELETE SET NULL,
  cliente_empresa_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo varchar(30) NOT NULL CHECK (tipo IN ('receita', 'despesa', 'transferencia_entrada', 'transferencia_saida')),
  origem varchar(40) NOT NULL DEFAULT 'manual' CHECK (origem IN ('cobranca', 'conta_pagar', 'outro_credito', 'outro_debito', 'transferencia', 'manual')),
  descricao text NOT NULL,
  categoria text NOT NULL DEFAULT 'Geral',
  valor numeric(15,2) NOT NULL CHECK (valor >= 0),
  data_competencia date NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento date,
  status varchar(20) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Cancelado')),
  referencia_id uuid,
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.financeiro_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['financeiro_configuracoes', 'financeiro_cobrancas', 'financeiro_lancamentos']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', r, r);
    EXECUTE format(
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.financeiro_set_updated_at()',
      r,
      r
    );
  END LOOP;
END;
$$;

ALTER TABLE public.financeiro_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_configuracoes_policy ON public.financeiro_configuracoes;
CREATE POLICY financeiro_configuracoes_policy ON public.financeiro_configuracoes
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS financeiro_cobrancas_policy ON public.financeiro_cobrancas;
CREATE POLICY financeiro_cobrancas_policy ON public.financeiro_cobrancas
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS financeiro_lancamentos_policy ON public.financeiro_lancamentos;
CREATE POLICY financeiro_lancamentos_policy ON public.financeiro_lancamentos
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

CREATE INDEX IF NOT EXISTS idx_financeiro_configuracoes_empresa ON public.financeiro_configuracoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_configuracoes_cliente ON public.financeiro_configuracoes(cliente_empresa_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_cobrancas_empresa_vencimento ON public.financeiro_cobrancas(empresa_id, data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_financeiro_cobrancas_status ON public.financeiro_cobrancas(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_empresa_data ON public.financeiro_lancamentos(empresa_id, data_competencia DESC);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_conta ON public.financeiro_lancamentos(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_eventos_logs_usuario ON public.configuracoes_eventos_logs(usuario_id);

CREATE OR REPLACE FUNCTION public.set_contador_responsavel(p_contador_id uuid)
RETURNS public.configuracoes_contadores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_row public.configuracoes_contadores;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  UPDATE public.configuracoes_contadores
  SET is_responsavel = false
  WHERE empresa_id = v_empresa_id;

  UPDATE public.configuracoes_contadores
  SET is_responsavel = true
  WHERE id = p_contador_id
    AND empresa_id = v_empresa_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Contador nao encontrado.';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_conta_bancaria(p_payload jsonb)
RETURNS public.configuracoes_contas_bancarias
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_id uuid := NULLIF(p_payload->>'id', '')::uuid;
  v_saldo_inicial numeric(15,2) := COALESCE((p_payload->>'saldo_inicial')::numeric, 0);
  v_row public.configuracoes_contas_bancarias;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.configuracoes_contas_bancarias (
      empresa_id, banco, agencia, numero_conta, tipo_conta, saldo_inicial, saldo_atual
    )
    VALUES (
      v_empresa_id,
      trim(p_payload->>'banco'),
      trim(p_payload->>'agencia'),
      trim(p_payload->>'numero_conta'),
      COALESCE(NULLIF(p_payload->>'tipo_conta', ''), 'corrente'),
      v_saldo_inicial,
      v_saldo_inicial
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.configuracoes_contas_bancarias
    SET
      banco = trim(p_payload->>'banco'),
      agencia = trim(p_payload->>'agencia'),
      numero_conta = trim(p_payload->>'numero_conta'),
      tipo_conta = COALESCE(NULLIF(p_payload->>'tipo_conta', ''), 'corrente'),
      saldo_atual = saldo_atual + (v_saldo_inicial - saldo_inicial),
      saldo_inicial = v_saldo_inicial
    WHERE id = v_id
      AND empresa_id = v_empresa_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'Conta bancaria nao encontrada.';
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contas_bancarias_resumo()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'saldoInicial', COALESCE(sum(saldo_inicial), 0),
    'saldoAtual', COALESCE(sum(saldo_atual), 0),
    'totalContas', count(*)
  )
  FROM public.configuracoes_contas_bancarias
  WHERE empresa_id = public.current_empresa_id()
$$;

CREATE OR REPLACE FUNCTION public.cancelar_cobranca_financeira(p_cobranca_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_rows integer;
BEGIN
  UPDATE public.financeiro_cobrancas
  SET status = 'Cancelado',
      data_cancelamento = now(),
      updated_at = now()
  WHERE id = p_cobranca_id
    AND empresa_id = v_empresa_id
    AND status <> 'Pago';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_boleto_financeiro(p_cobranca_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_rows integer;
BEGIN
  UPDATE public.financeiro_cobrancas
  SET asaas_boleto_url = NULL,
      updated_at = now()
  WHERE id = p_cobranca_id
    AND empresa_id = v_empresa_id
    AND status = 'Pendente';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.emitir_nfse_asaas(p_cobranca_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_nfse_id text;
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.financeiro_cobrancas
  WHERE id = p_cobranca_id
    AND empresa_id = v_empresa_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Cobranca nao encontrada.';
  END IF;

  IF v_status = 'Cancelado' THEN
    RAISE EXCEPTION 'Nao e possivel emitir NFS-e para cobranca cancelada.';
  END IF;

  v_nfse_id := 'nfse_' || encode(digest(p_cobranca_id::text || now()::text, 'sha256'), 'hex');

  UPDATE public.financeiro_cobrancas
  SET asaas_nfse_id = v_nfse_id,
      updated_at = now()
  WHERE id = p_cobranca_id
    AND empresa_id = v_empresa_id;

  RETURN v_nfse_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_recebimento_financeiro(p_cobranca_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_cobranca public.financeiro_cobrancas;
BEGIN
  UPDATE public.financeiro_cobrancas
  SET status = 'Pago',
      data_pagamento = now(),
      updated_at = now()
  WHERE id = p_cobranca_id
    AND empresa_id = v_empresa_id
    AND status <> 'Cancelado'
  RETURNING * INTO v_cobranca;

  IF v_cobranca.id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.financeiro_lancamentos (
    empresa_id, cliente_empresa_id, tipo, origem, descricao, categoria, valor,
    data_competencia, data_pagamento, status, referencia_id
  )
  VALUES (
    v_empresa_id, v_cobranca.cliente_empresa_id, 'receita', 'cobranca',
    v_cobranca.descricao, v_cobranca.categoria, v_cobranca.valor,
    v_cobranca.data_vencimento, CURRENT_DATE, 'Pago', v_cobranca.id
  )
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_contrato_financeiro(p_payload jsonb)
RETURNS public.financeiro_configuracoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_id uuid := NULLIF(p_payload->>'id', '')::uuid;
  v_row public.financeiro_configuracoes;
  v_vencimento date;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.financeiro_configuracoes (
      empresa_id, cliente_empresa_id, descricao_servico, valor_mensal, dia_vencimento,
      emissao_automatica_nfse, ativo
    )
    VALUES (
      v_empresa_id,
      NULLIF(p_payload->>'cliente_empresa_id', '')::uuid,
      COALESCE(NULLIF(p_payload->>'descricao_servico', ''), 'Honorarios contabeis'),
      COALESCE((p_payload->>'valor_mensal')::numeric, 0),
      COALESCE((p_payload->>'dia_vencimento')::integer, 10),
      COALESCE((p_payload->>'emissao_automatica_nfse')::boolean, false),
      COALESCE((p_payload->>'ativo')::boolean, true)
    )
    RETURNING * INTO v_row;

    v_vencimento := make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::integer,
      EXTRACT(MONTH FROM CURRENT_DATE)::integer,
      LEAST(v_row.dia_vencimento, 28)
    );

    IF v_vencimento < CURRENT_DATE THEN
      v_vencimento := (v_vencimento + interval '1 month')::date;
    END IF;

    INSERT INTO public.financeiro_cobrancas (
      empresa_id, contrato_id, cliente_empresa_id, descricao, categoria, valor, data_vencimento,
      status, meio_pagamento, asaas_cobranca_id, asaas_boleto_url
    )
    VALUES (
      v_empresa_id, v_row.id, v_row.cliente_empresa_id, v_row.descricao_servico, 'Faturamento',
      v_row.valor_mensal, v_vencimento, 'Pendente', 'Boleto',
      'pay_' || substr(encode(digest(v_row.id::text || now()::text, 'sha256'), 'hex'), 1, 16),
      'https://asaas.com/b/pay_' || substr(encode(digest(v_row.id::text, 'sha256'), 'hex'), 1, 16)
    );
  ELSE
    UPDATE public.financeiro_configuracoes
    SET cliente_empresa_id = NULLIF(p_payload->>'cliente_empresa_id', '')::uuid,
        descricao_servico = COALESCE(NULLIF(p_payload->>'descricao_servico', ''), descricao_servico),
        valor_mensal = COALESCE((p_payload->>'valor_mensal')::numeric, valor_mensal),
        dia_vencimento = COALESCE((p_payload->>'dia_vencimento')::integer, dia_vencimento),
        emissao_automatica_nfse = COALESCE((p_payload->>'emissao_automatica_nfse')::boolean, emissao_automatica_nfse),
        ativo = COALESCE((p_payload->>'ativo')::boolean, ativo)
    WHERE id = v_id
      AND empresa_id = v_empresa_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'Contrato nao encontrado.';
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_cobranca_manual_financeira(p_payload jsonb)
RETURNS public.financeiro_cobrancas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_row public.financeiro_cobrancas;
  v_hash text;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sem empresa vinculada.';
  END IF;

  v_hash := substr(encode(digest((p_payload::text || now()::text), 'sha256'), 'hex'), 1, 16);

  INSERT INTO public.financeiro_cobrancas (
    empresa_id, cliente_empresa_id, descricao, categoria, valor, data_vencimento,
    status, meio_pagamento, asaas_cobranca_id, asaas_boleto_url
  )
  VALUES (
    v_empresa_id,
    NULLIF(p_payload->>'cliente_empresa_id', '')::uuid,
    COALESCE(NULLIF(p_payload->>'descricao', ''), 'Cobranca avulsa'),
    COALESCE(NULLIF(p_payload->>'categoria', ''), 'Faturamento'),
    COALESCE((p_payload->>'valor')::numeric, 0),
    COALESCE((p_payload->>'data_vencimento')::date, CURRENT_DATE),
    'Pendente',
    COALESCE(NULLIF(p_payload->>'meio_pagamento', ''), 'Boleto'),
    'pay_' || v_hash,
    CASE
      WHEN COALESCE(NULLIF(p_payload->>'meio_pagamento', ''), 'Boleto') = 'Pix'
        THEN 'https://asaas.com/pix/pay_' || v_hash
      ELSE 'https://asaas.com/b/pay_' || v_hash
    END
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_financeiro_dashboard(p_meses integer DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_result jsonb;
BEGIN
  IF v_empresa_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  WITH cobrancas AS (
    SELECT *
    FROM public.financeiro_cobrancas
    WHERE empresa_id = v_empresa_id
      AND status <> 'Cancelado'
  ),
  lancamentos AS (
    SELECT *
    FROM public.financeiro_lancamentos
    WHERE empresa_id = v_empresa_id
      AND status <> 'Cancelado'
  ),
  totais AS (
    SELECT
      COALESCE((SELECT sum(saldo_atual) FROM public.configuracoes_contas_bancarias WHERE empresa_id = v_empresa_id), 0) AS saldo_disponivel,
      COALESCE((SELECT sum(valor) FROM cobrancas WHERE status IN ('Pendente', 'Vencido')), 0) AS contas_receber,
      COALESCE((SELECT sum(valor) FROM lancamentos WHERE origem = 'conta_pagar' AND status = 'Pendente'), 0) AS contas_pagar,
      COALESCE((SELECT sum(valor) FROM cobrancas WHERE status = 'Pago'), 0) AS receitas_recebidas,
      COALESCE((SELECT sum(valor) FROM lancamentos WHERE tipo = 'despesa' AND status = 'Pago'), 0) AS despesas_pagas,
      COALESCE((SELECT sum(valor) FROM cobrancas WHERE status = 'Vencido'), 0) AS vencido
  ),
  periodos AS (
    SELECT date_trunc('month', CURRENT_DATE)::date - (n || ' months')::interval AS mes
    FROM generate_series(GREATEST(COALESCE(p_meses, 6), 1) - 1, 0, -1) AS n
  ),
  desempenho AS (
    SELECT jsonb_agg(jsonb_build_object(
      'name', initcap(to_char(p.mes, 'Mon')),
      'receita', COALESCE((SELECT sum(valor) FROM cobrancas c WHERE date_trunc('month', c.data_vencimento)::date = p.mes), 0),
      'despesas', COALESCE((SELECT sum(valor) FROM lancamentos l WHERE l.tipo = 'despesa' AND date_trunc('month', l.data_competencia)::date = p.mes), 0),
      'lucro', COALESCE((SELECT sum(valor) FROM cobrancas c WHERE c.status = 'Pago' AND date_trunc('month', c.data_vencimento)::date = p.mes), 0)
             - COALESCE((SELECT sum(valor) FROM lancamentos l WHERE l.tipo = 'despesa' AND l.status = 'Pago' AND date_trunc('month', l.data_competencia)::date = p.mes), 0)
    )) AS data
    FROM periodos p
  ),
  contas AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'banco', banco,
      'agencia', agencia,
      'conta', numero_conta,
      'saldo', saldo_atual
    ) ORDER BY saldo_atual DESC), '[]'::jsonb) AS data
    FROM public.configuracoes_contas_bancarias
    WHERE empresa_id = v_empresa_id
  ),
  parceiros AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', cliente_empresa_id,
      'nome', COALESCE(cl.nome, 'Cliente removido'),
      'valor', valor_total,
      'percentual', CASE WHEN total_geral > 0 THEN round((valor_total / total_geral) * 100, 1) ELSE 0 END
    ) ORDER BY valor_total DESC), '[]'::jsonb) AS data
    FROM (
      SELECT cliente_empresa_id, sum(valor) AS valor_total, sum(sum(valor)) OVER () AS total_geral
      FROM cobrancas
      WHERE status = 'Pago'
      GROUP BY cliente_empresa_id
      LIMIT 5
    ) p
    LEFT JOIN public.clientes cl ON cl.id = p.cliente_empresa_id
  ),
  categorias AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', categoria,
      'nome', categoria,
      'valor', valor_total,
      'percentual', CASE WHEN total_geral > 0 THEN round((valor_total / total_geral) * 100, 1) ELSE 0 END
    ) ORDER BY valor_total DESC), '[]'::jsonb) AS data
    FROM (
      SELECT categoria, sum(valor) AS valor_total, sum(sum(valor)) OVER () AS total_geral
      FROM lancamentos
      WHERE tipo = 'despesa'
      GROUP BY categoria
      LIMIT 6
    ) c
  )
  SELECT jsonb_build_object(
    'totalFaturado', COALESCE((SELECT sum(valor) FROM cobrancas), 0),
    'totalRecebido', (SELECT receitas_recebidas FROM totais),
    'totalPendente', (SELECT contas_receber FROM totais),
    'taxaInadimplencia',
      CASE
        WHEN (SELECT receitas_recebidas + vencido FROM totais) > 0
          THEN round(((SELECT vencido FROM totais) / (SELECT receitas_recebidas + vencido FROM totais)) * 100, 1)
        ELSE 0
      END,
    'saldoDisponivel', (SELECT saldo_disponivel FROM totais),
    'contasReceber', (SELECT contas_receber FROM totais),
    'contasPagar', (SELECT contas_pagar FROM totais),
    'receitasRecebidas', (SELECT receitas_recebidas FROM totais),
    'despesasPagas', (SELECT despesas_pagas FROM totais),
    'lucroMes', (SELECT receitas_recebidas - despesas_pagas FROM totais),
    'patrimonioLiquido', (SELECT saldo_disponivel + receitas_recebidas - despesas_pagas - contas_pagar FROM totais),
    'desempenho', (SELECT data FROM desempenho),
    'contas', (SELECT data FROM contas),
    'receitasPorParceiro', (SELECT data FROM parceiros),
    'despesasPorCategoria', (SELECT data FROM categorias)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_faturamento_dashboard(
  p_data_inicial date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  p_data_final date DEFAULT (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date,
  p_cliente_empresa_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_result jsonb;
BEGIN
  WITH base AS (
    SELECT *
    FROM public.financeiro_cobrancas c
    WHERE c.empresa_id = v_empresa_id
      AND c.data_vencimento BETWEEN p_data_inicial AND p_data_final
      AND (p_cliente_empresa_id IS NULL OR c.cliente_empresa_id = p_cliente_empresa_id)
      AND (p_status IS NULL OR p_status = 'Todos' OR c.status = p_status)
  )
  SELECT jsonb_build_object(
    'nfseAEmitir', count(*) FILTER (WHERE asaas_nfse_id IS NULL AND status <> 'Cancelado'),
    'nfseEmitidas', count(*) FILTER (WHERE asaas_nfse_id IS NOT NULL AND status <> 'Cancelado'),
    'nfseCanceladas', count(*) FILTER (WHERE status = 'Cancelado' AND asaas_nfse_id IS NOT NULL),
    'cobrancasGeradas', count(*),
    'contasReceber', count(*) FILTER (WHERE status IN ('Pendente', 'Vencido')),
    'totalPrevisto', COALESCE(sum(valor) FILTER (WHERE status <> 'Cancelado'), 0),
    'totalRecebido', COALESCE(sum(valor) FILTER (WHERE status = 'Pago'), 0),
    'totalAberto', COALESCE(sum(valor) FILTER (WHERE status = 'Pendente'), 0),
    'totalAtraso', COALESCE(sum(valor) FILTER (WHERE status = 'Vencido'), 0)
  ) INTO v_result
  FROM base;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'configuracoes_contas_bancarias') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_contas_bancarias;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'configuracoes_contadores') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_contadores;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'configuracoes_eventos_logs') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_eventos_logs;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'financeiro_configuracoes') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_configuracoes;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'financeiro_cobrancas') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_cobrancas;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'financeiro_lancamentos') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_lancamentos;
    END IF;
  END IF;
END;
$$;
