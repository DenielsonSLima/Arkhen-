-- Amplia o contrato canônico de Obrigações sem alterar migrations já publicadas.
-- Códigos públicos: diaria, unica, semanal, quinzenal, mensal, trimestral,
-- semestral e anual. "personalizada" permanece aceita apenas no legado/config
-- por cliente, para não invalidar agendas que já existam.

SET lock_timeout = '10s';

DO $$
BEGIN
  IF to_regclass('public.parametrizacao_protocolos_tipos') IS NULL
     OR to_regclass('public.parametrizacao_prazos_entrega') IS NULL
     OR to_regclass('public.atividades_rotinas') IS NULL THEN
    RAISE EXCEPTION 'Pré-requisitos das periodicidades de obrigações ausentes.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parametrizacao_protocolos_tipos tipo
    WHERE tipo.periodicidade_padrao NOT IN (
      'diaria', 'semanal', 'quinzenal', 'mensal',
      'trimestral', 'semestral', 'personalizada'
    )
  ) OR EXISTS (
    SELECT 1
    FROM public.parametrizacao_prazos_entrega prazo
    WHERE prazo.fechamento NOT IN (
      'diaria', 'semanal', 'quinzenal', 'mensal',
      'trimestral', 'semestral', 'personalizada'
    )
  ) THEN
    RAISE EXCEPTION 'Há periodicidade legada desconhecida; revise antes de ampliar o contrato.';
  END IF;

  -- A versão anterior permitia estes códigos no CHECK, mas não possuía os
  -- campos necessários para inferir a agenda com segurança.
  IF EXISTS (
    SELECT 1 FROM public.parametrizacao_protocolos_tipos
    WHERE periodicidade_padrao = 'semanal'
  ) OR EXISTS (
    SELECT 1 FROM public.parametrizacao_prazos_entrega
    WHERE fechamento = 'semanal'
  ) THEN
    RAISE EXCEPTION 'Há periodicidade semanal legada sem dia da semana canônico.';
  END IF;
END;
$$;

ALTER TABLE public.parametrizacao_protocolos_tipos
  ADD COLUMN IF NOT EXISTS dia_semana_iso smallint,
  ADD COLUMN IF NOT EXISTS mes_vencimento smallint,
  ADD COLUMN IF NOT EXISTS data_vencimento date;

ALTER TABLE public.parametrizacao_prazos_entrega
  ADD COLUMN IF NOT EXISTS dia_semana_iso smallint,
  ADD COLUMN IF NOT EXISTS mes_vencimento smallint,
  ADD COLUMN IF NOT EXISTS data_vencimento date;

ALTER TABLE public.parametrizacao_protocolos_tipos
  DROP CONSTRAINT IF EXISTS parametrizacao_protocolos_tipos_periodicidade_padrao_check,
  DROP CONSTRAINT IF EXISTS parametrizacao_protocolos_tipos_dia_semana_iso_check,
  DROP CONSTRAINT IF EXISTS parametrizacao_protocolos_tipos_mes_vencimento_check,
  DROP CONSTRAINT IF EXISTS parametrizacao_protocolos_tipos_agenda_canonica_check;

ALTER TABLE public.parametrizacao_protocolos_tipos
  ADD CONSTRAINT parametrizacao_protocolos_tipos_periodicidade_padrao_check
    CHECK (periodicidade_padrao IN (
      'diaria', 'unica', 'semanal', 'quinzenal', 'mensal',
      'trimestral', 'semestral', 'anual', 'personalizada'
    )),
  ADD CONSTRAINT parametrizacao_protocolos_tipos_dia_semana_iso_check
    CHECK (dia_semana_iso IS NULL OR dia_semana_iso BETWEEN 1 AND 7),
  ADD CONSTRAINT parametrizacao_protocolos_tipos_mes_vencimento_check
    CHECK (mes_vencimento IS NULL OR mes_vencimento BETWEEN 1 AND 12),
  ADD CONSTRAINT parametrizacao_protocolos_tipos_agenda_canonica_check
    CHECK (
      (periodicidade_padrao = 'semanal'
        AND dia_semana_iso IS NOT NULL
        AND mes_vencimento IS NULL
        AND data_vencimento IS NULL)
      OR (periodicidade_padrao = 'anual'
        AND dia_semana_iso IS NULL
        AND mes_vencimento IS NOT NULL
        AND data_vencimento IS NULL)
      OR (periodicidade_padrao = 'unica'
        AND dia_semana_iso IS NULL
        AND mes_vencimento IS NULL
        AND data_vencimento IS NOT NULL)
      OR (periodicidade_padrao NOT IN ('semanal', 'anual', 'unica')
        AND dia_semana_iso IS NULL
        AND mes_vencimento IS NULL
        AND data_vencimento IS NULL)
    );

ALTER TABLE public.parametrizacao_prazos_entrega
  DROP CONSTRAINT IF EXISTS parametrizacao_prazos_entrega_fechamento_check,
  DROP CONSTRAINT IF EXISTS parametrizacao_prazos_entrega_dia_semana_iso_check,
  DROP CONSTRAINT IF EXISTS parametrizacao_prazos_entrega_mes_vencimento_check,
  DROP CONSTRAINT IF EXISTS parametrizacao_prazos_entrega_agenda_canonica_check;

ALTER TABLE public.parametrizacao_prazos_entrega
  ADD CONSTRAINT parametrizacao_prazos_entrega_fechamento_check
    CHECK (fechamento IN (
      'diaria', 'unica', 'semanal', 'quinzenal', 'mensal',
      'trimestral', 'semestral', 'anual', 'personalizada'
    )),
  ADD CONSTRAINT parametrizacao_prazos_entrega_dia_semana_iso_check
    CHECK (dia_semana_iso IS NULL OR dia_semana_iso BETWEEN 1 AND 7),
  ADD CONSTRAINT parametrizacao_prazos_entrega_mes_vencimento_check
    CHECK (mes_vencimento IS NULL OR mes_vencimento BETWEEN 1 AND 12),
  ADD CONSTRAINT parametrizacao_prazos_entrega_agenda_canonica_check
    CHECK (
      (fechamento = 'semanal'
        AND dia_semana_iso IS NOT NULL
        AND mes_vencimento IS NULL
        AND data_vencimento IS NULL)
      OR (fechamento = 'anual'
        AND dia_semana_iso IS NULL
        AND mes_vencimento IS NOT NULL
        AND data_vencimento IS NULL)
      OR (fechamento = 'unica'
        AND dia_semana_iso IS NULL
        AND mes_vencimento IS NULL
        AND data_vencimento IS NOT NULL)
      OR (fechamento NOT IN ('semanal', 'anual', 'unica')
        AND dia_semana_iso IS NULL
        AND mes_vencimento IS NULL
        AND data_vencimento IS NULL)
    );

COMMENT ON COLUMN public.parametrizacao_protocolos_tipos.dia_semana_iso IS
  'Dia ISO (1=segunda, 7=domingo), obrigatório apenas para periodicidade semanal.';
COMMENT ON COLUMN public.parametrizacao_protocolos_tipos.mes_vencimento IS
  'Mês (1-12), obrigatório apenas para periodicidade anual.';
COMMENT ON COLUMN public.parametrizacao_protocolos_tipos.data_vencimento IS
  'Data ISO da ocorrência, obrigatória apenas para periodicidade única.';

COMMENT ON COLUMN public.parametrizacao_prazos_entrega.dia_semana_iso IS
  'Espelho legado do dia ISO da obrigação semanal.';
COMMENT ON COLUMN public.parametrizacao_prazos_entrega.mes_vencimento IS
  'Espelho legado do mês da obrigação anual.';
COMMENT ON COLUMN public.parametrizacao_prazos_entrega.data_vencimento IS
  'Espelho legado da data da obrigação única.';

RESET lock_timeout;
