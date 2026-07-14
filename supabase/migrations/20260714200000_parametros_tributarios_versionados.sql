-- Catálogo tributário versionado. Registros globais (empresa_id IS NULL) são
-- publicados por migração e não podem ser alterados pelos usuários da aplicação.
-- Escritórios podem criar overrides próprios, sempre isolados por empresa.

CREATE TABLE public.parametros_tributarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN (
    'irrf_mensal', 'irpf_anual', 'inss', 'carne_leao',
    'dividendos', 'ganho_capital', 'mei'
  )),
  nome text NOT NULL,
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  versao text NOT NULL,
  fonte_url text NOT NULL,
  norma text NOT NULL,
  bloqueado boolean NOT NULL DEFAULT false,
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (codigo = upper(codigo) AND codigo ~ '^[A-Z0-9_]+$'),
  CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio),
  CHECK (jsonb_typeof(configuracao) = 'object'),
  CHECK ((empresa_id IS NULL AND bloqueado) OR empresa_id IS NOT NULL)
);

CREATE UNIQUE INDEX parametros_tributarios_global_uk
  ON public.parametros_tributarios (codigo, vigencia_inicio, versao)
  WHERE empresa_id IS NULL;
CREATE UNIQUE INDEX parametros_tributarios_empresa_uk
  ON public.parametros_tributarios (empresa_id, codigo, vigencia_inicio, versao)
  WHERE empresa_id IS NOT NULL;
CREATE INDEX parametros_tributarios_busca_idx
  ON public.parametros_tributarios (codigo, vigencia_inicio DESC, vigencia_fim);
CREATE INDEX parametros_tributarios_empresa_idx
  ON public.parametros_tributarios (empresa_id, tipo, vigencia_inicio DESC);

CREATE TABLE public.parametros_tributarios_faixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parametro_id uuid NOT NULL REFERENCES public.parametros_tributarios(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  ordem integer NOT NULL CHECK (ordem > 0),
  limite_inferior numeric(18,2) NOT NULL DEFAULT 0 CHECK (limite_inferior >= 0),
  limite_superior numeric(18,2),
  aliquota numeric(12,8) NOT NULL DEFAULT 0 CHECK (aliquota >= 0),
  parcela_deduzir numeric(18,2) NOT NULL DEFAULT 0 CHECK (parcela_deduzir >= 0),
  configuracao jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parametro_id, ordem),
  CHECK (limite_superior IS NULL OR limite_superior >= limite_inferior),
  CHECK (jsonb_typeof(configuracao) = 'object')
);

CREATE INDEX parametros_tributarios_faixas_busca_idx
  ON public.parametros_tributarios_faixas (parametro_id, ordem);
CREATE INDEX parametros_tributarios_faixas_empresa_idx
  ON public.parametros_tributarios_faixas (empresa_id, parametro_id);

CREATE TABLE public.simulacoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id()
    REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL DEFAULT auth.uid(),
  tipo text NOT NULL,
  competencia date NOT NULL,
  entrada jsonb NOT NULL,
  resultado jsonb NOT NULL,
  versoes_parametros jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (tipo ~ '^[a-z0-9_-]+$'),
  CHECK (jsonb_typeof(entrada) = 'object'),
  CHECK (jsonb_typeof(resultado) = 'object'),
  CHECK (jsonb_typeof(versoes_parametros) = 'array')
);

CREATE INDEX simulacoes_historico_empresa_idx
  ON public.simulacoes_historico (empresa_id, criado_em DESC);
CREATE INDEX simulacoes_historico_tipo_idx
  ON public.simulacoes_historico (empresa_id, tipo, competencia DESC);

ALTER TABLE public.parametros_tributarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametros_tributarios_faixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulacoes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY parametros_tributarios_select_tenant
  ON public.parametros_tributarios FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR empresa_id = public.current_empresa_id());

CREATE POLICY parametros_tributarios_insert_tenant
  ON public.parametros_tributarios FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND empresa_id IS NOT NULL
    AND bloqueado = false
  );

CREATE POLICY parametros_tributarios_update_tenant
  ON public.parametros_tributarios FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND empresa_id IS NOT NULL
    AND bloqueado = false
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND empresa_id IS NOT NULL
    AND bloqueado = false
  );

CREATE POLICY parametros_tributarios_delete_tenant
  ON public.parametros_tributarios FOR DELETE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND empresa_id IS NOT NULL
    AND bloqueado = false
  );

CREATE POLICY parametros_faixas_select_tenant
  ON public.parametros_tributarios_faixas FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR empresa_id = public.current_empresa_id());

CREATE POLICY parametros_faixas_insert_tenant
  ON public.parametros_tributarios_faixas FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND empresa_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.parametros_tributarios p
      WHERE p.id = parametro_id
        AND p.empresa_id = public.current_empresa_id()
        AND p.bloqueado = false
    )
  );

CREATE POLICY parametros_faixas_update_tenant
  ON public.parametros_tributarios_faixas FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND empresa_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.parametros_tributarios p
      WHERE p.id = parametro_id
        AND p.empresa_id = public.current_empresa_id()
        AND p.bloqueado = false
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND empresa_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.parametros_tributarios p
      WHERE p.id = parametro_id
        AND p.empresa_id = public.current_empresa_id()
        AND p.bloqueado = false
    )
  );

CREATE POLICY parametros_faixas_delete_tenant
  ON public.parametros_tributarios_faixas FOR DELETE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND empresa_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.parametros_tributarios p
      WHERE p.id = parametro_id
        AND p.empresa_id = public.current_empresa_id()
        AND p.bloqueado = false
    )
  );

CREATE POLICY simulacoes_historico_select_tenant
  ON public.simulacoes_historico FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

-- O histórico é escrito exclusivamente pelas RPCs SECURITY DEFINER.
REVOKE ALL ON TABLE public.parametros_tributarios FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.parametros_tributarios_faixas FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.simulacoes_historico FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.parametros_tributarios TO authenticated;
GRANT SELECT ON TABLE public.parametros_tributarios_faixas TO authenticated;
GRANT SELECT ON TABLE public.simulacoes_historico TO authenticated;

INSERT INTO public.parametros_tributarios
  (id, empresa_id, codigo, tipo, nome, vigencia_inicio, versao, fonte_url, norma, bloqueado, configuracao)
VALUES
  ('10000000-0000-4000-8000-000000000001', NULL, 'IRRF_MENSAL_2026', 'irrf_mensal',
   'IRRF mensal 2026', '2026-01-01', '2026.1',
   'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026',
   'Lei nº 15.270/2025 e tabela progressiva mensal 2026', true,
   '{"deducaoDependente":189.59,"descontoSimplificado":607.20,"reducaoIntegralAte":5000.00,"reducaoMaxima":312.89,"reducaoParcialAte":7350.00,"reducaoParcialConstante":978.62,"reducaoParcialCoeficiente":0.133145}'::jsonb),
  ('10000000-0000-4000-8000-000000000002', NULL, 'IRPF_ANUAL_2026', 'irpf_anual',
   'IRPF anual — ano-calendário 2026', '2026-01-01', '2026.1',
   'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026',
   'Lei nº 15.270/2025 e tabela progressiva anual 2026', true,
   '{"deducaoDependente":2275.08,"limiteEducacaoPorPessoa":3561.50,"descontoSimplificadoPercentual":20,"descontoSimplificadoLimite":17640.00,"reducaoIntegralAte":60000.00,"reducaoMaxima":2694.15,"reducaoParcialAte":88200.00,"reducaoParcialConstante":8429.73,"reducaoParcialCoeficiente":0.095575}'::jsonb),
  ('10000000-0000-4000-8000-000000000003', NULL, 'INSS_EMPREGADO_2026', 'inss',
   'INSS progressivo do empregado 2026', '2026-01-01', '2026.1',
   'https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal',
   'Portaria Interministerial MPS/MF — tabela de contribuição 2026', true,
   '{"salarioMinimo":1621.00,"tetoBeneficios":8475.55,"categoria":"empregado"}'::jsonb),
  ('10000000-0000-4000-8000-000000000004', NULL, 'CARNE_LEAO_2026', 'carne_leao',
   'Carnê-Leão e Livro Caixa 2026', '2026-01-01', '2026.1',
   'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/carne-leao/carne-leao',
   'RIR/2018 e orientações da Receita Federal para o Carnê-Leão', true,
   '{"codigoDarf":"0190","vencimento":"ultimo_dia_util_mes_seguinte","usaTabela":"IRRF_MENSAL_2026","livroCaixaLimitadoAosRendimentos":true}'::jsonb),
  ('10000000-0000-4000-8000-000000000005', NULL, 'DIVIDENDOS_2026', 'dividendos',
   'Lucros, dividendos e alta renda 2026', '2026-01-01', '2026.1',
   'https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirf/manual_padrao_rfb_per_tributacao_cotin_v-19-12-2025.pdf',
   'Lei nº 15.270/2025', true,
   '{"limiteMensalPorFonte":50000.00,"aliquotaRetencao":10,"altaRendaInicioAnual":600000.00,"altaRendaAliquotaMaximaEm":1200000.00,"altaRendaAliquotaMaxima":10}'::jsonb),
  ('10000000-0000-4000-8000-000000000006', NULL, 'GANHO_CAPITAL_2026', 'ganho_capital',
   'Ganho de capital 2026', '2026-01-01', '2026.1',
   'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/ganhos-de-capital',
   'Lei nº 13.259/2016 e regulamentação do ganho de capital', true,
   '{"limitePequenaAlienacaoGeral":35000.00,"limitePequenaAlienacaoAcoes":20000.00,"prazoReinvestimentoImovelDias":180,"codigoDarf":"4600"}'::jsonb),
  ('10000000-0000-4000-8000-000000000007', NULL, 'MEI_2026', 'mei',
   'Limites e contribuição do MEI 2026', '2026-01-01', '2026.1',
   'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/perguntas-frequentes/o-que-e-o-microempreendedor-individual-mei/qual-o-faturamento-anual-do',
   'Lei Complementar nº 123/2006 e regras do SIMEI', true,
   '{"limiteAnual":81000.00,"limiteMensalProporcional":6750.00,"limiteAnualCaminhoneiro":251600.00,"limiteMensalCaminhoneiro":20966.67,"toleranciaExcessoPercentual":20,"salarioMinimo":1621.00,"inssPercentual":5,"inssCaminhoneiroPercentual":12,"icmsFixo":1.00,"issFixo":5.00,"ocupacoesFonte":"Anexo XI da Resolução CGSN 140/2018","ocupacoesCatalogoCompleto":false,"ocupacoesPermitidas":["1412601","1412602","4321500","4322301","4330402","4330405","4399103","4520001","4520003","4520006","4712100","4721102","4722901","4781400","4930201","4930202","4930203","4930204","5320202","5611201","5611203","8219999","9529102","9529104","9529105","9602501","9602502","9609207","9609208","9609299"]}'::jsonb);

INSERT INTO public.parametros_tributarios_faixas
  (parametro_id, empresa_id, ordem, limite_inferior, limite_superior, aliquota, parcela_deduzir)
VALUES
  ('10000000-0000-4000-8000-000000000001', NULL, 1, 0,       2428.80,  0,     0),
  ('10000000-0000-4000-8000-000000000001', NULL, 2, 2428.81, 2826.65,  7.5, 182.16),
  ('10000000-0000-4000-8000-000000000001', NULL, 3, 2826.66, 3751.05, 15.0, 394.16),
  ('10000000-0000-4000-8000-000000000001', NULL, 4, 3751.06, 4664.68, 22.5, 675.49),
  ('10000000-0000-4000-8000-000000000001', NULL, 5, 4664.69, NULL,    27.5, 908.73),
  ('10000000-0000-4000-8000-000000000002', NULL, 1, 0,        29145.60,  0,     0),
  ('10000000-0000-4000-8000-000000000002', NULL, 2, 29145.61, 33919.80,  7.5, 2185.92),
  ('10000000-0000-4000-8000-000000000002', NULL, 3, 33919.81, 45012.60, 15.0, 4729.91),
  ('10000000-0000-4000-8000-000000000002', NULL, 4, 45012.61, 55976.16, 22.5, 8105.85),
  ('10000000-0000-4000-8000-000000000002', NULL, 5, 55976.17, NULL,     27.5, 10904.66),
  ('10000000-0000-4000-8000-000000000003', NULL, 1, 0,       1621.00,  7.5, 0),
  ('10000000-0000-4000-8000-000000000003', NULL, 2, 1621.01, 2902.84,  9.0, 0),
  ('10000000-0000-4000-8000-000000000003', NULL, 3, 2902.85, 4354.27, 12.0, 0),
  ('10000000-0000-4000-8000-000000000003', NULL, 4, 4354.28, 8475.55, 14.0, 0),
  ('10000000-0000-4000-8000-000000000006', NULL, 1, 0,           5000000.00, 15.0, 0),
  ('10000000-0000-4000-8000-000000000006', NULL, 2, 5000000.01,  10000000.00, 17.5, 0),
  ('10000000-0000-4000-8000-000000000006', NULL, 3, 10000000.01, 30000000.00, 20.0, 0),
  ('10000000-0000-4000-8000-000000000006', NULL, 4, 30000000.01, NULL,        22.5, 0);

CREATE OR REPLACE FUNCTION public.listar_parametros_tributarios(p_tipo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada.';
  END IF;

  IF p_tipo IS NOT NULL AND p_tipo NOT IN (
    'irrf_mensal', 'irpf_anual', 'inss', 'carne_leao',
    'dividendos', 'ganho_capital', 'mei'
  ) THEN
    RAISE EXCEPTION 'Tipo de parâmetro tributário inválido.';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.tipo, x.nome), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT DISTINCT ON (p.codigo)
      p.id,
      p.codigo,
      p.tipo,
      p.nome,
      p.vigencia_inicio AS "vigenciaInicio",
      p.vigencia_fim AS "vigenciaFim",
      p.versao,
      p.fonte_url AS fonte,
      p.norma,
      p.bloqueado,
      (p.empresa_id IS NULL) AS oficial,
      p.configuracao,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'ordem', f.ordem,
          'limiteInferior', f.limite_inferior,
          'limiteSuperior', f.limite_superior,
          'aliquota', f.aliquota,
          'parcelaDeduzir', f.parcela_deduzir,
          'configuracao', f.configuracao
        ) ORDER BY f.ordem)
        FROM public.parametros_tributarios_faixas f
        WHERE f.parametro_id = p.id
      ), '[]'::jsonb) AS faixas
    FROM public.parametros_tributarios p
    WHERE (p.empresa_id IS NULL OR p.empresa_id = v_empresa_id)
      AND (p_tipo IS NULL OR p.tipo = p_tipo)
      AND p.vigencia_inicio <= CURRENT_DATE
      AND (p.vigencia_fim IS NULL OR p.vigencia_fim >= CURRENT_DATE)
    ORDER BY p.codigo, (p.empresa_id = v_empresa_id) DESC, p.vigencia_inicio DESC, p.criado_em DESC
  ) x;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_parametros_tributarios(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_parametros_tributarios(text) TO authenticated;

-- Consulta histórica explícita. Mantém o contrato anterior, baseado na data
-- corrente, e oferece uma RPC sem sobrecarga/ambiguidade no PostgREST.
CREATE OR REPLACE FUNCTION public.listar_parametros_tributarios_por_competencia(
  p_tipo text DEFAULT NULL,
  p_competencia date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_competencia date := COALESCE(p_competencia, CURRENT_DATE);
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa vinculada.';
  END IF;

  IF p_tipo IS NOT NULL AND p_tipo NOT IN (
    'irrf_mensal', 'irpf_anual', 'inss', 'carne_leao',
    'dividendos', 'ganho_capital', 'mei'
  ) THEN
    RAISE EXCEPTION 'Tipo de parâmetro tributário inválido.';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.tipo, x.nome), '[]'::jsonb)
  INTO v_resultado
  FROM (
    SELECT DISTINCT ON (p.codigo)
      p.id,
      p.codigo,
      p.tipo,
      p.nome,
      p.vigencia_inicio AS "vigenciaInicio",
      p.vigencia_fim AS "vigenciaFim",
      p.versao,
      p.fonte_url AS fonte,
      p.norma,
      p.bloqueado,
      (p.empresa_id IS NULL) AS oficial,
      p.configuracao,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'ordem', f.ordem,
          'limiteInferior', f.limite_inferior,
          'limiteSuperior', f.limite_superior,
          'aliquota', f.aliquota,
          'parcelaDeduzir', f.parcela_deduzir,
          'configuracao', f.configuracao
        ) ORDER BY f.ordem)
        FROM public.parametros_tributarios_faixas f
        WHERE f.parametro_id = p.id
      ), '[]'::jsonb) AS faixas
    FROM public.parametros_tributarios p
    WHERE (p.empresa_id IS NULL OR p.empresa_id = v_empresa_id)
      AND (p_tipo IS NULL OR p.tipo = p_tipo)
      AND p.vigencia_inicio <= v_competencia
      AND (p.vigencia_fim IS NULL OR p.vigencia_fim >= v_competencia)
    ORDER BY p.codigo, (p.empresa_id = v_empresa_id) DESC, p.vigencia_inicio DESC, p.criado_em DESC
  ) x;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_parametros_tributarios_por_competencia(text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_parametros_tributarios_por_competencia(text,date) TO authenticated;
