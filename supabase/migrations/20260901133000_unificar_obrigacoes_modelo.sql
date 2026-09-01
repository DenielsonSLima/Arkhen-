-- Consolida catálogo, prazos por regime e modelos de checklist em uma obrigação canônica.
-- Nomes podem se repetir; o código identifica cada variante de fluxo.

DO $$
BEGIN
  IF to_regclass('public.parametrizacao_protocolos_tipos') IS NULL
     OR to_regclass('public.parametrizacao_prazos_entrega') IS NULL
     OR to_regclass('public.atividades_modelos') IS NULL
     OR to_regclass('public.configuracoes_protocolos_empresas') IS NULL
     OR to_regclass('public.atividades_rotinas') IS NULL
     OR to_regclass('public.clientes') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'parametrizacao_protocolos_tipos'
         AND column_name = 'id' AND udt_name = 'uuid'
     )
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'parametrizacao_protocolos_tipos'
         AND column_name = 'codigo'
     )
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'atividades_modelos'
         AND column_name = 'id' AND udt_name = 'uuid'
     )
     OR (
       SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'parametrizacao_protocolos_tipos'
         AND column_name = ANY(ARRAY[
           'empresa_id', 'codigo', 'nome', 'categoria', 'orgao', 'dia_limite',
           'descricao', 'regimes', 'periodicidade_padrao', 'origem_padrao',
           'sistema', 'ativo', 'atualizado_em'
         ])
     ) <> 13
     OR (
       SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'parametrizacao_prazos_entrega'
         AND column_name = ANY(ARRAY[
           'empresa_id', 'regime', 'entrega_id', 'entrega_nome', 'categoria',
           'dia_vencimento', 'referencia_mes_anterior', 'fechamento',
           'dia_vencimento_primeira_quinzena',
           'dia_vencimento_segunda_quinzena', 'sistema', 'ativo', 'atualizado_em'
         ])
     ) <> 13
  THEN
    RAISE EXCEPTION 'Schema de parametrização divergente; reconcilie as migrations remotas antes de unificar obrigações.';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.atividades_modelos modelo
    WHERE CASE WHEN jsonb_typeof(modelo.etapas) = 'array'
      THEN jsonb_array_length(modelo.etapas) > 80
      ELSE true
    END
  ) THEN
    RAISE EXCEPTION 'Há modelo de atividade com etapas inválidas ou acima do limite de 80.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_prazos_entrega prazo
    LEFT JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = prazo.empresa_id
     AND tipo.codigo = prazo.entrega_id
    WHERE tipo.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Há prazo sem item correspondente no catálogo de obrigações.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_protocolos_tipos tipo
    WHERE tipo.periodicidade_padrao NOT IN (
      'mensal', 'quinzenal', 'trimestral', 'semestral'
    )
  ) OR EXISTS (
    SELECT 1
    FROM public.parametrizacao_prazos_entrega prazo
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = prazo.empresa_id
     AND tipo.codigo = prazo.entrega_id
    WHERE prazo.ativo = true
      AND prazo.fechamento NOT IN ('mensal', 'quinzenal', 'trimestral', 'semestral')
  ) THEN
    RAISE EXCEPTION 'Há periodicidade legada incompatível com o modelo unificado de obrigações.';
  END IF;

  IF EXISTS (
    SELECT prazo.empresa_id, prazo.entrega_id
    FROM public.parametrizacao_prazos_entrega prazo
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = prazo.empresa_id
     AND tipo.codigo = prazo.entrega_id
    WHERE prazo.ativo = true
    GROUP BY prazo.empresa_id, prazo.entrega_id
    HAVING count(DISTINCT (
      prazo.dia_vencimento,
      COALESCE(prazo.referencia_mes_anterior, true),
      prazo.fechamento,
      COALESCE(prazo.dia_vencimento_primeira_quinzena, 20),
      COALESCE(prazo.dia_vencimento_segunda_quinzena, prazo.dia_vencimento)
    )) > 1
  ) THEN
    RAISE EXCEPTION 'Há prazos divergentes entre regimes; crie variantes antes de unificar as obrigações.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_prazos_entrega prazo
    JOIN public.parametrizacao_protocolos_tipos tipo
      ON tipo.empresa_id = prazo.empresa_id
     AND tipo.codigo = prazo.entrega_id
    WHERE prazo.ativo = true
      AND prazo.fechamento = 'quinzenal'
      AND COALESCE(prazo.dia_vencimento_primeira_quinzena, 20)
          >= COALESCE(
            prazo.dia_vencimento_segunda_quinzena, prazo.dia_vencimento
          )
  ) THEN
    RAISE EXCEPTION 'Há prazo quinzenal legado com a 1ª data posterior à 2ª.';
  END IF;
END;
$$;

ALTER TABLE public.parametrizacao_protocolos_tipos
  ADD COLUMN IF NOT EXISTS etapas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tem_vencimento boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS referencia_mes_anterior boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dia_vencimento_primeira_quinzena integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS dia_vencimento_segunda_quinzena integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS modelo_atividade_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS atividades_modelos_id_empresa_id_unq
  ON public.atividades_modelos (id, empresa_id);

ALTER TABLE public.parametrizacao_protocolos_tipos
  DROP CONSTRAINT IF EXISTS parametrizacao_protocolos_tipos_modelo_atividade_id_fkey,
  DROP CONSTRAINT IF EXISTS parametrizacao_protocolos_tipos_modelo_tenant_fkey,
  ADD CONSTRAINT parametrizacao_protocolos_tipos_modelo_tenant_fkey
    FOREIGN KEY (modelo_atividade_id, empresa_id)
    REFERENCES public.atividades_modelos (id, empresa_id)
    ON DELETE RESTRICT;

ALTER TABLE public.parametrizacao_protocolos_tipos
  DROP CONSTRAINT IF EXISTS parametrizacao_protocolos_tipos_etapas_check,
  ADD CONSTRAINT parametrizacao_protocolos_tipos_etapas_check CHECK (
    jsonb_typeof(etapas) = 'array'
    AND jsonb_array_length(etapas) <= 80
  ),
  DROP CONSTRAINT IF EXISTS parametrizacao_protocolos_tipos_dia_primeira_check,
  ADD CONSTRAINT parametrizacao_protocolos_tipos_dia_primeira_check
    CHECK (dia_vencimento_primeira_quinzena BETWEEN 1 AND 31),
  DROP CONSTRAINT IF EXISTS parametrizacao_protocolos_tipos_dia_segunda_check,
  ADD CONSTRAINT parametrizacao_protocolos_tipos_dia_segunda_check
    CHECK (dia_vencimento_segunda_quinzena BETWEEN 1 AND 31);

CREATE INDEX IF NOT EXISTS idx_protocolos_tipos_modelo_atividade
  ON public.parametrizacao_protocolos_tipos (empresa_id, modelo_atividade_id);

-- O regime selecionado no novo card equivale ao antigo toggle por regime.
-- Uma desativação explícita é removida da seleção; uma ativação explícita fora
-- do catálogo é incorporada. Se todos estavam desligados, o card fica inativo
-- e conserva os regimes originais para permitir uma reativação consciente.
WITH reconciliados AS (
  SELECT
    tipo.id,
    CASE WHEN COALESCE(cardinality(tipo.regimes), 0) = 0
      THEN ARRAY[
        'PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta'
      ]::text[]
      ELSE ARRAY(
        SELECT permitido
        FROM unnest(ARRAY[
          'PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta'
        ]::text[]) permitido
        WHERE EXISTS (
          SELECT 1 FROM unnest(tipo.regimes) original
          WHERE CASE WHEN original = 'Isento' THEN 'Isenta' ELSE original END = permitido
        )
      )
    END AS regimes_originais,
    ARRAY(
      SELECT permitido
      FROM unnest(ARRAY[
        'PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta'
      ]::text[]) permitido
      WHERE (
        (
          (
            COALESCE(cardinality(tipo.regimes), 0) = 0
            OR EXISTS (
              SELECT 1 FROM unnest(tipo.regimes) original
              WHERE CASE WHEN original = 'Isento' THEN 'Isenta' ELSE original END = permitido
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.parametrizacao_prazos_entrega prazo_inativo
            WHERE prazo_inativo.empresa_id = tipo.empresa_id
              AND prazo_inativo.entrega_id = tipo.codigo
              AND CASE WHEN prazo_inativo.regime = 'Isento'
                THEN 'Isenta' ELSE prazo_inativo.regime END = permitido
              AND prazo_inativo.ativo = false
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.parametrizacao_prazos_entrega prazo_ativo
          WHERE prazo_ativo.empresa_id = tipo.empresa_id
            AND prazo_ativo.entrega_id = tipo.codigo
            AND CASE WHEN prazo_ativo.regime = 'Isento'
              THEN 'Isenta' ELSE prazo_ativo.regime END = permitido
            AND prazo_ativo.ativo = true
        )
      )
    ) AS regimes_ativos
  FROM public.parametrizacao_protocolos_tipos tipo
)
UPDATE public.parametrizacao_protocolos_tipos tipo
SET regimes = CASE WHEN cardinality(item.regimes_ativos) = 0
      THEN item.regimes_originais ELSE item.regimes_ativos END,
    ativo = tipo.ativo AND cardinality(item.regimes_ativos) > 0,
    dia_vencimento_primeira_quinzena = 20,
    dia_vencimento_segunda_quinzena = tipo.dia_limite
FROM reconciliados item
WHERE item.id = tipo.id;

-- Como o card possui uma agenda única, a migration só prossegue quando os
-- regimes ativos concordam (preflight acima) e então importa a agenda real.
WITH candidatos AS (
  SELECT DISTINCT ON (tipo.id)
    tipo.id,
    prazo.dia_vencimento,
    COALESCE(prazo.referencia_mes_anterior, true) AS referencia_mes_anterior,
    prazo.fechamento,
    COALESCE(prazo.dia_vencimento_primeira_quinzena, 20) AS dia_primeira,
    COALESCE(
      prazo.dia_vencimento_segunda_quinzena, prazo.dia_vencimento
    ) AS dia_segunda
  FROM public.parametrizacao_protocolos_tipos tipo
  JOIN public.parametrizacao_prazos_entrega prazo
    ON prazo.empresa_id = tipo.empresa_id
   AND prazo.entrega_id = tipo.codigo
   AND prazo.ativo = true
   AND CASE WHEN prazo.regime = 'Isento' THEN 'Isenta' ELSE prazo.regime END
       = ANY(tipo.regimes)
  ORDER BY tipo.id, prazo.atualizado_em DESC, prazo.regime
)
UPDATE public.parametrizacao_protocolos_tipos tipo
SET dia_limite = candidato.dia_vencimento,
    referencia_mes_anterior = candidato.referencia_mes_anterior,
    periodicidade_padrao = candidato.fechamento,
    dia_vencimento_primeira_quinzena = candidato.dia_primeira,
    dia_vencimento_segunda_quinzena = candidato.dia_segunda,
    atualizado_em = now()
FROM candidatos candidato
WHERE candidato.id = tipo.id;

-- Aproveita os fluxos existentes somente quando o código é igual; nomes não são
-- usados como chave para evitar unir variantes distintas de uma obrigação.
UPDATE public.parametrizacao_protocolos_tipos tipo
SET etapas = modelo.etapas,
    modelo_atividade_id = modelo.id,
    ordem = modelo.ordem,
    atualizado_em = now()
FROM public.atividades_modelos modelo
WHERE modelo.empresa_id = tipo.empresa_id
  AND modelo.codigo = tipo.codigo
  AND modelo.codigo <> 'tarefas-internas';

-- Modelos contábeis que ainda não estavam no catálogo passam a ser obrigações
-- sem vencimento legal. Tarefas internas continuam pertencendo a Rotinas.
INSERT INTO public.parametrizacao_protocolos_tipos (
  empresa_id,
  codigo,
  nome,
  categoria,
  orgao,
  dia_limite,
  descricao,
  regimes,
  periodicidade_padrao,
  origem_padrao,
  sistema,
  ativo,
  etapas,
  tem_vencimento,
  referencia_mes_anterior,
  dia_vencimento_primeira_quinzena,
  dia_vencimento_segunda_quinzena,
  ordem,
  modelo_atividade_id
)
SELECT
  modelo.empresa_id,
  modelo.codigo,
  modelo.nome,
  CASE
    WHEN modelo.codigo = 'obras' THEN 'Trabalhista'
    WHEN modelo.codigo IN ('dctfweb-tributos-federais', 'obrigacoes-mensais') THEN 'Fiscal'
    WHEN modelo.categoria IN ('Fiscal', 'Contábil', 'Trabalhista', 'Financeiro')
      THEN modelo.categoria
    WHEN lower(modelo.nome) LIKE '%folha%' OR lower(modelo.nome) LIKE '%pró-labore%'
      THEN 'Trabalhista'
    ELSE 'Documentos'
  END,
  '',
  20,
  modelo.descricao,
  CASE WHEN COALESCE(cardinality(modelo.tipos), 0) = 0
    THEN ARRAY[
      'PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Isenta'
    ]::text[]
    ELSE ARRAY(
      SELECT DISTINCT CASE WHEN regime = 'Isento' THEN 'Isenta' ELSE regime END
      FROM unnest(modelo.tipos) regime
      WHERE regime IN (
        'PF', 'MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real',
        'Isenta', 'Isento'
      )
    )
  END,
  'mensal',
  'Ambos',
  modelo.sistema,
  modelo.ativo,
  modelo.etapas,
  false,
  true,
  15,
  30,
  modelo.ordem,
  modelo.id
FROM public.atividades_modelos modelo
WHERE modelo.codigo <> 'tarefas-internas'
  AND NOT EXISTS (
    SELECT 1
    FROM public.parametrizacao_protocolos_tipos tipo
    WHERE tipo.empresa_id = modelo.empresa_id
      AND tipo.codigo = modelo.codigo
  );

UPDATE public.parametrizacao_protocolos_tipos tipo
SET etapas = jsonb_build_array(tipo.nome), atualizado_em = now()
WHERE jsonb_array_length(tipo.etapas) = 0;

-- Todo card possui um modelo espelho para as rotinas legadas. A obrigação segue
-- sendo a fonte canônica e as edições futuras atualizam esse espelho na mesma RPC.
INSERT INTO public.atividades_modelos (
  empresa_id, codigo, nome, descricao, categoria, tipos, etapas, sistema, ativo, ordem
)
SELECT
  tipo.empresa_id,
  tipo.codigo,
  tipo.nome,
  tipo.descricao,
  CASE
    WHEN tipo.categoria = 'Trabalhista' THEN 'Folha'
    WHEN tipo.categoria IN ('Fiscal', 'Financeiro', 'Contábil') THEN tipo.categoria
    ELSE 'Controle'
  END,
  tipo.regimes,
  tipo.etapas,
  tipo.sistema,
  tipo.ativo,
  tipo.ordem
FROM public.parametrizacao_protocolos_tipos tipo
WHERE tipo.modelo_atividade_id IS NULL
  AND tipo.codigo <> 'tarefas-internas'
  AND NOT EXISTS (
    SELECT 1 FROM public.atividades_modelos modelo
    WHERE modelo.empresa_id = tipo.empresa_id AND modelo.codigo = tipo.codigo
  );

UPDATE public.parametrizacao_protocolos_tipos tipo
SET modelo_atividade_id = modelo.id,
    atualizado_em = now()
FROM public.atividades_modelos modelo
WHERE modelo.empresa_id = tipo.empresa_id
  AND modelo.codigo = tipo.codigo
  AND tipo.codigo <> 'tarefas-internas'
  AND tipo.modelo_atividade_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_protocolos_tipos_modelo_unico
  ON public.parametrizacao_protocolos_tipos (empresa_id, modelo_atividade_id)
  WHERE modelo_atividade_id IS NOT NULL;

-- Mantém a projeção antiga de prazos para todos os regimes. Linhas sem
-- vencimento ficam inativas e, por isso, não viram protocolos legais falsos.
INSERT INTO public.parametrizacao_prazos_entrega AS prazo (
  empresa_id, regime, entrega_id, entrega_nome, categoria, dia_vencimento,
  referencia_mes_anterior, fechamento, dia_vencimento_primeira_quinzena,
  dia_vencimento_segunda_quinzena, sistema, ativo
)
SELECT
  tipo.empresa_id,
  regime,
  tipo.codigo,
  tipo.nome,
  tipo.categoria,
  tipo.dia_limite,
  tipo.referencia_mes_anterior,
  tipo.periodicidade_padrao,
  tipo.dia_vencimento_primeira_quinzena,
  tipo.dia_vencimento_segunda_quinzena,
  tipo.sistema,
  tipo.ativo AND tipo.tem_vencimento
FROM public.parametrizacao_protocolos_tipos tipo
CROSS JOIN LATERAL unnest(tipo.regimes) regime
ON CONFLICT (empresa_id, regime, entrega_id) DO UPDATE SET
  entrega_nome = EXCLUDED.entrega_nome,
  categoria = EXCLUDED.categoria,
  atualizado_em = now();

-- Empresas provisionadas depois desta migration também recebem o modelo espelho.
CREATE OR REPLACE FUNCTION app_private.sincronizar_modelo_obrigacao_canonica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_modelo_id uuid;
  v_etapas_modelo jsonb;
  v_guard_anterior text := COALESCE(
    current_setting('app.obrigacao_canonica_write', true), 'off'
  );
BEGIN
  IF NEW.codigo = 'tarefas-internas' THEN
    NEW.modelo_atividade_id := NULL;
    RETURN NEW;
  END IF;
  PERFORM set_config('app.obrigacao_canonica_write', 'on', true);

  SELECT modelo.id, modelo.etapas
  INTO v_modelo_id, v_etapas_modelo
  FROM public.atividades_modelos modelo
  WHERE modelo.empresa_id = NEW.empresa_id AND modelo.codigo = NEW.codigo
  FOR UPDATE;

  IF jsonb_array_length(NEW.etapas) = 0 THEN
    NEW.etapas := CASE
      WHEN jsonb_typeof(v_etapas_modelo) = 'array'
           AND jsonb_array_length(v_etapas_modelo) > 0 THEN v_etapas_modelo
      ELSE jsonb_build_array(NEW.nome)
    END;
  END IF;

  INSERT INTO public.atividades_modelos AS modelo (
    id, empresa_id, codigo, nome, descricao, categoria, tipos, etapas,
    sistema, ativo, ordem
  ) VALUES (
    COALESCE(v_modelo_id, gen_random_uuid()), NEW.empresa_id, NEW.codigo,
    NEW.nome, NEW.descricao,
    CASE WHEN NEW.categoria = 'Trabalhista' THEN 'Folha'
      WHEN NEW.categoria IN ('Fiscal', 'Financeiro', 'Contábil') THEN NEW.categoria
      ELSE 'Controle' END,
    NEW.regimes, NEW.etapas, NEW.sistema, NEW.ativo, NEW.ordem
  )
  ON CONFLICT (empresa_id, codigo) DO UPDATE SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    categoria = EXCLUDED.categoria,
    tipos = EXCLUDED.tipos,
    etapas = EXCLUDED.etapas,
    ativo = EXCLUDED.ativo,
    ordem = EXCLUDED.ordem,
    atualizado_em = now()
  RETURNING modelo.id INTO NEW.modelo_atividade_id;

  PERFORM set_config('app.obrigacao_canonica_write', v_guard_anterior, true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sincronizar_modelo_obrigacao_canonica
  ON public.parametrizacao_protocolos_tipos;
CREATE TRIGGER sincronizar_modelo_obrigacao_canonica
  BEFORE INSERT OR UPDATE OF nome, descricao, categoria, regimes, etapas,
    sistema, ativo, ordem
  ON public.parametrizacao_protocolos_tipos
  FOR EACH ROW
  EXECUTE FUNCTION app_private.sincronizar_modelo_obrigacao_canonica();

REVOKE ALL ON FUNCTION app_private.sincronizar_modelo_obrigacao_canonica()
  FROM PUBLIC, anon, authenticated;
