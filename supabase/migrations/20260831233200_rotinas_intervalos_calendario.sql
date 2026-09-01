-- Bimestral e anual deixam de avançar por aproximações de 60/365 dias.
-- O intervalo em meses fica explícito no banco, mantendo o dia da âncora.

ALTER TABLE public.atividades_rotinas
  ADD COLUMN IF NOT EXISTS intervalo_meses smallint;

ALTER TABLE public.atividades_rotinas
  DROP CONSTRAINT IF EXISTS atividades_rotinas_agenda_check;
ALTER TABLE public.atividades_rotinas
  DROP CONSTRAINT IF EXISTS atividades_rotinas_intervalo_meses_check;

CREATE OR REPLACE FUNCTION app_private.normalizar_agenda_rotina_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.data_ancora := COALESCE(NEW.data_ancora, NEW.proxima_execucao);
    NEW.proxima_execucao_base := COALESCE(
      NEW.proxima_execucao_base,
      NEW.proxima_execucao
    );
  ELSE
    NEW.data_ancora := COALESCE(
      NEW.data_ancora,
      OLD.data_ancora,
      NEW.proxima_execucao
    );
    IF NEW.proxima_execucao IS DISTINCT FROM OLD.proxima_execucao
       AND NEW.proxima_execucao_base IS NOT DISTINCT FROM OLD.proxima_execucao_base THEN
      NEW.proxima_execucao_base := NEW.proxima_execucao;
    ELSE
      NEW.proxima_execucao_base := COALESCE(
        NEW.proxima_execucao_base,
        OLD.proxima_execucao_base,
        NEW.proxima_execucao
      );
    END IF;
  END IF;

  NEW.intervalo_meses := CASE
    WHEN NEW.frequencia = 'Personalizada' AND NEW.intervalo_dias = 60 THEN 2
    WHEN NEW.frequencia = 'Personalizada' AND NEW.intervalo_dias = 365 THEN 12
    ELSE NULL
  END;

  IF NEW.frequencia = 'Semanal' THEN
    NEW.dia_semana_iso := COALESCE(
      NEW.dia_semana_iso,
      extract(isodow FROM NEW.data_ancora)::smallint
    );
    NEW.dia_mes := NULL;
  ELSIF NEW.frequencia IN ('Mensal', 'Trimestral', 'Semestral')
        OR NEW.intervalo_meses IS NOT NULL THEN
    NEW.dia_mes := COALESCE(
      NEW.dia_mes,
      extract(day FROM NEW.data_ancora)::smallint
    );
    NEW.dia_semana_iso := NULL;
  ELSE
    NEW.dia_mes := NULL;
    NEW.dia_semana_iso := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalizar_agenda_rotina ON public.atividades_rotinas;
CREATE TRIGGER normalizar_agenda_rotina
  BEFORE INSERT OR UPDATE OF
    frequencia,
    intervalo_dias,
    intervalo_meses,
    proxima_execucao,
    data_ancora,
    proxima_execucao_base,
    dia_mes,
    dia_semana_iso
  ON public.atividades_rotinas
  FOR EACH ROW
  EXECUTE FUNCTION app_private.normalizar_agenda_rotina_trigger();

UPDATE public.atividades_rotinas
SET intervalo_meses = CASE intervalo_dias WHEN 60 THEN 2 ELSE 12 END,
    dia_mes = COALESCE(
      dia_mes,
      extract(day FROM COALESCE(data_ancora, proxima_execucao))::smallint
    ),
    dia_semana_iso = NULL
WHERE frequencia = 'Personalizada'
  AND intervalo_dias IN (60, 365);

ALTER TABLE public.atividades_rotinas
  ADD CONSTRAINT atividades_rotinas_intervalo_meses_check
  CHECK (
    (intervalo_meses IS NULL)
    OR (
      frequencia = 'Personalizada'
      AND intervalo_meses IN (2, 12)
      AND intervalo_dias = CASE intervalo_meses WHEN 2 THEN 60 ELSE 365 END
    )
  );

ALTER TABLE public.atividades_rotinas
  ADD CONSTRAINT atividades_rotinas_agenda_check
  CHECK (
    CASE
      WHEN frequencia = 'Semanal' THEN
        dia_semana_iso IS NOT NULL AND dia_mes IS NULL
      WHEN frequencia IN ('Mensal', 'Trimestral', 'Semestral')
           OR intervalo_meses IS NOT NULL THEN
        dia_mes IS NOT NULL AND dia_semana_iso IS NULL
      ELSE dia_mes IS NULL AND dia_semana_iso IS NULL
    END
  );

COMMENT ON COLUMN public.atividades_rotinas.intervalo_meses IS
  'Cadência de calendário para bimestral (2) e anual (12); evita deriva de 60/365 dias.';

CREATE OR REPLACE FUNCTION app_private.primeira_data_base_rotina(
  p_referencia date,
  p_frequencia text,
  p_intervalo_dias integer,
  p_data_ancora date,
  p_dia_mes integer,
  p_dia_semana_iso integer,
  p_incluir_finais_de_semana boolean
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_referencia date := greatest(p_referencia, p_data_ancora);
  v_candidata date;
  v_meses integer;
  v_passo_meses integer;
  v_passos integer;
  v_dia_ancora integer;
BEGIN
  IF p_referencia IS NULL OR p_data_ancora IS NULL THEN
    RAISE EXCEPTION 'Referência e âncora são obrigatórias' USING ERRCODE = '22023';
  END IF;

  CASE p_frequencia
    WHEN 'Diária' THEN
      v_candidata := v_referencia;
      IF NOT p_incluir_finais_de_semana THEN
        v_candidata := app_private.ajustar_data_rotina(v_candidata, false);
      END IF;
    WHEN 'Semanal' THEN
      IF p_dia_semana_iso NOT BETWEEN 1 AND 7 THEN
        RAISE EXCEPTION 'Dia da semana inválido' USING ERRCODE = '22023';
      END IF;
      v_candidata := v_referencia
        + ((p_dia_semana_iso - extract(isodow FROM v_referencia)::integer + 7) % 7);
    WHEN 'Quinzenal' THEN
      v_passos := greatest(0, ceil((v_referencia - p_data_ancora) / 15.0)::integer);
      v_candidata := p_data_ancora + (v_passos * 15);
    WHEN 'Mensal', 'Trimestral', 'Semestral' THEN
      IF p_dia_mes NOT BETWEEN 1 AND 31 THEN
        RAISE EXCEPTION 'Dia do mês inválido' USING ERRCODE = '22023';
      END IF;
      v_passo_meses := CASE p_frequencia
        WHEN 'Mensal' THEN 1 WHEN 'Trimestral' THEN 3 ELSE 6 END;
      v_meses := (
        extract(year FROM v_referencia)::integer * 12
        + extract(month FROM v_referencia)::integer
        - extract(year FROM p_data_ancora)::integer * 12
        - extract(month FROM p_data_ancora)::integer
      );
      v_passos := greatest(0, floor(v_meses::numeric / v_passo_meses)::integer);
      v_candidata := app_private.data_mes_ancorada(
        (date_trunc('month', p_data_ancora::timestamp)
          + make_interval(months => v_passos * v_passo_meses))::date,
        p_dia_mes
      );
      IF v_candidata < v_referencia THEN
        v_candidata := app_private.data_mes_ancorada(
          (date_trunc('month', p_data_ancora::timestamp)
            + make_interval(months => (v_passos + 1) * v_passo_meses))::date,
          p_dia_mes
        );
      END IF;
    WHEN 'Personalizada' THEN
      IF p_intervalo_dias NOT BETWEEN 1 AND 366 THEN
        RAISE EXCEPTION 'Intervalo inválido' USING ERRCODE = '22023';
      END IF;
      IF p_intervalo_dias IN (60, 365) THEN
        v_passo_meses := CASE p_intervalo_dias WHEN 60 THEN 2 ELSE 12 END;
        v_dia_ancora := COALESCE(
          p_dia_mes,
          extract(day FROM p_data_ancora)::integer
        );
        v_meses := (
          extract(year FROM v_referencia)::integer * 12
          + extract(month FROM v_referencia)::integer
          - extract(year FROM p_data_ancora)::integer * 12
          - extract(month FROM p_data_ancora)::integer
        );
        v_passos := greatest(0, floor(v_meses::numeric / v_passo_meses)::integer);
        v_candidata := app_private.data_mes_ancorada(
          (date_trunc('month', p_data_ancora::timestamp)
            + make_interval(months => v_passos * v_passo_meses))::date,
          v_dia_ancora
        );
        IF v_candidata < v_referencia THEN
          v_candidata := app_private.data_mes_ancorada(
            (date_trunc('month', p_data_ancora::timestamp)
              + make_interval(months => (v_passos + 1) * v_passo_meses))::date,
            v_dia_ancora
          );
        END IF;
      ELSE
        v_passos := greatest(
          0,
          ceil((v_referencia - p_data_ancora)::numeric / p_intervalo_dias)::integer
        );
        v_candidata := p_data_ancora + (v_passos * p_intervalo_dias);
      END IF;
    WHEN 'Única' THEN v_candidata := p_data_ancora;
    ELSE
      RAISE EXCEPTION 'Frequência inválida' USING ERRCODE = '22023';
  END CASE;
  RETURN v_candidata;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.proxima_data_base_rotina(
  p_data_base date,
  p_frequencia text,
  p_intervalo_dias integer,
  p_data_ancora date,
  p_dia_mes integer,
  p_dia_semana_iso integer,
  p_incluir_finais_de_semana boolean
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_resultado date;
  v_dia_ancora integer := COALESCE(
    p_dia_mes,
    extract(day FROM p_data_ancora)::integer
  );
BEGIN
  CASE p_frequencia
    WHEN 'Diária' THEN
      v_resultado := p_data_base + 1;
      IF NOT p_incluir_finais_de_semana THEN
        v_resultado := app_private.ajustar_data_rotina(v_resultado, false);
      END IF;
    WHEN 'Semanal' THEN v_resultado := p_data_base + 7;
    WHEN 'Quinzenal' THEN v_resultado := p_data_base + 15;
    WHEN 'Mensal' THEN
      v_resultado := app_private.data_mes_ancorada(
        (date_trunc('month', p_data_base::timestamp) + interval '1 month')::date,
        p_dia_mes
      );
    WHEN 'Trimestral' THEN
      v_resultado := app_private.data_mes_ancorada(
        (date_trunc('month', p_data_base::timestamp) + interval '3 months')::date,
        p_dia_mes
      );
    WHEN 'Semestral' THEN
      v_resultado := app_private.data_mes_ancorada(
        (date_trunc('month', p_data_base::timestamp) + interval '6 months')::date,
        p_dia_mes
      );
    WHEN 'Personalizada' THEN
      IF p_intervalo_dias IN (60, 365) THEN
        v_resultado := app_private.data_mes_ancorada(
          (date_trunc('month', p_data_base::timestamp)
            + make_interval(months => CASE p_intervalo_dias WHEN 60 THEN 2 ELSE 12 END))::date,
          v_dia_ancora
        );
      ELSE
        v_resultado := p_data_base + p_intervalo_dias;
      END IF;
    WHEN 'Única' THEN v_resultado := p_data_base;
    ELSE
      RAISE EXCEPTION 'Frequência inválida' USING ERRCODE = '22023';
  END CASE;
  RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION public.proxima_data_rotina(
  p_data date,
  p_frequencia text,
  p_intervalo_dias integer,
  p_incluir_finais_de_semana boolean
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proxima date;
BEGIN
  v_proxima := CASE p_frequencia
    WHEN 'Diária' THEN p_data + 1
    WHEN 'Semanal' THEN p_data + 7
    WHEN 'Quinzenal' THEN p_data + 15
    WHEN 'Mensal' THEN (p_data + interval '1 month')::date
    WHEN 'Trimestral' THEN (p_data + interval '3 months')::date
    WHEN 'Semestral' THEN (p_data + interval '6 months')::date
    WHEN 'Personalizada' THEN CASE p_intervalo_dias
      WHEN 60 THEN (p_data + interval '2 months')::date
      WHEN 365 THEN (p_data + interval '12 months')::date
      ELSE p_data + greatest(COALESCE(p_intervalo_dias, 1), 1)
    END
    ELSE p_data + greatest(COALESCE(p_intervalo_dias, 1), 1)
  END;
  IF NOT COALESCE(p_incluir_finais_de_semana, false) THEN
    WHILE extract(isodow FROM v_proxima) IN (6, 7) LOOP
      v_proxima := v_proxima + 1;
    END LOOP;
  END IF;
  RETURN v_proxima;
END;
$$;
