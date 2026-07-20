-- Corrige o drift do cache de progresso e aceita competências MM/AAAA ou AAAA-MM.

CREATE TABLE IF NOT EXISTS public.conformidade_obrigacoes (
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id() REFERENCES public.empresas(id) ON DELETE CASCADE,
  obrigacao_id text NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  status varchar(12) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em andamento', 'Concluído')),
  responsavel varchar(180),
  etapas jsonb NOT NULL DEFAULT '[]'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, obrigacao_id)
);

CREATE INDEX IF NOT EXISTS idx_conformidade_obrigacoes_empresa_id
  ON public.conformidade_obrigacoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_conformidade_obrigacoes_obrigacao_id
  ON public.conformidade_obrigacoes (obrigacao_id);
CREATE INDEX IF NOT EXISTS idx_conformidade_obrigacoes_cliente_id
  ON public.conformidade_obrigacoes (cliente_id);

ALTER TABLE public.conformidade_obrigacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conformidade_obrigacoes_policy ON public.conformidade_obrigacoes;
CREATE POLICY conformidade_obrigacoes_policy
  ON public.conformidade_obrigacoes
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id))
  WITH CHECK (public.is_empresa_member(empresa_id));

DROP TRIGGER IF EXISTS set_conformidade_obrigacoes_updated_at ON public.conformidade_obrigacoes;
CREATE TRIGGER set_conformidade_obrigacoes_updated_at
  BEFORE UPDATE ON public.conformidade_obrigacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'conformidade_obrigacoes'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conformidade_obrigacoes;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_conformidade_operacional(p_cliente_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_result jsonb;
BEGIN
  v_empresa_id := public.current_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa ativa';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'vencimento', item->>'clienteNome'), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', ai.id::text,
      'tipo', 'fiscal',
      'clienteId', COALESCE(ai.cliente_id::text, ai.cliente_nome),
      'clienteNome', ai.cliente_nome,
      'cnpj', COALESCE(c.cnpj, ''),
      'competencia', ai.competencia,
      'rotina', COALESCE(am.nome, ai.modelo_codigo, 'Atividade operacional'),
      'descricao', COALESCE(am.descricao, 'Risco derivado de atividade operacional.'),
      'responsavel', 'Sem responsável',
      'vencimento', competencia.vencimento::text,
      'prioridade', CASE
        WHEN competencia.vencimento < CURRENT_DATE THEN 'vermelho'
        WHEN competencia.vencimento <= CURRENT_DATE + 3 THEN 'amarelo'
        ELSE 'verde'
      END,
      'status', CASE
        WHEN ai.status = 'Concluída' THEN 'Concluído'
        WHEN ai.status = 'Em andamento' THEN 'Em andamento'
        ELSE 'Pendente'
      END,
      'atrasoDias', GREATEST(0, CURRENT_DATE - competencia.vencimento),
      'regraContrato', jsonb_build_object(
        'prazoDias', 0,
        'impacto', CASE WHEN ai.status = 'Concluída' THEN 1 ELSE 4 END,
        'consequencia', 'Risco operacional calculado a partir das atividades do cliente.'
      ),
      'etapas', jsonb_build_array(
        jsonb_build_object('id', 'recebimento', 'label', 'Recebimento', 'concluida', COALESCE((ai.checklists->>'recebimento')::boolean, false)),
        jsonb_build_object('id', 'conferencia', 'label', 'Conferência', 'concluida', COALESCE((ai.checklists->>'conferencia')::boolean, false)),
        jsonb_build_object('id', 'apuracao', 'label', 'Apuração', 'concluida', COALESCE((ai.checklists->>'apuracao')::boolean, false)),
        jsonb_build_object('id', 'entrega', 'label', 'Entrega', 'concluida', COALESCE((ai.checklists->>'entrega')::boolean, false)),
        jsonb_build_object('id', 'fechamento', 'label', 'Fechamento', 'concluida', ai.status = 'Concluída')
      ),
      'documentosPendentes', '[]'::jsonb,
      'criadoEm', COALESCE(ai.criado_em, now())::text,
      'atualizadoEm', COALESCE(ai.atualizado_em, now())::text
    ) AS item
    FROM public.atividades_instancias ai
    LEFT JOIN public.clientes c ON c.id = ai.cliente_id
    LEFT JOIN public.atividades_modelos am ON am.id = ai.modelo_id
    CROSS JOIN LATERAL (
      SELECT (
        date_trunc(
          'month',
          CASE
            WHEN ai.competencia ~ '^[0-9]{2}/[0-9]{4}$' THEN to_date('01/' || ai.competencia, 'DD/MM/YYYY')
            WHEN ai.competencia ~ '^[0-9]{4}-[0-9]{2}$' THEN to_date(ai.competencia || '-01', 'YYYY-MM-DD')
            ELSE NULL
          END
        ) + interval '1 month - 1 day'
      )::date AS vencimento
    ) competencia
    WHERE ai.empresa_id = v_empresa_id
      AND competencia.vencimento IS NOT NULL
      AND COALESCE(ai.ativo, true) = true
      AND (p_cliente_id IS NULL OR ai.cliente_id = p_cliente_id)
  ) source;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_conformidade_operacional(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conformidade_operacional(uuid) TO authenticated, service_role;
