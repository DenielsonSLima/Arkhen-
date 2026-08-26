CREATE OR REPLACE FUNCTION public.validar_empresa_sem_placeholder()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_nome_normalizado text := lower(regexp_replace(btrim(NEW.nome), '\\s+', ' ', 'g'));
  v_razao_normalizada text := lower(regexp_replace(btrim(COALESCE(NEW.razao_social, '')), '\\s+', ' ', 'g'));
BEGIN
  IF v_nome_normalizado IN ('minha empresa', 'empresa exemplo', 'empresa fictícia contábil') THEN
    RAISE EXCEPTION
      'Informe o nome real da empresa para concluir o cadastro.'
      USING ERRCODE = '22023';
  END IF;

  IF v_razao_normalizada IN ('minha empresa', 'empresa exemplo', 'empresa fictícia contábil') THEN
    RAISE EXCEPTION
      'Informe a razão social real da empresa para concluir o cadastro.'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validar_empresa_sem_placeholder_before_write
ON public.empresas;

CREATE TRIGGER validar_empresa_sem_placeholder_before_write
BEFORE INSERT OR UPDATE OF nome, razao_social
ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.validar_empresa_sem_placeholder();

COMMENT ON FUNCTION public.validar_empresa_sem_placeholder() IS
  'Impede que fallbacks e massas fictícias criem empresas sem identidade real.';

CREATE OR REPLACE FUNCTION public.listar_agenda_padroes_ocorrencias(
  p_ano_inicio integer,
  p_mes_inicio integer,
  p_meses integer DEFAULT 1
)
RETURNS TABLE (
  id text,
  titulo text,
  descricao text,
  tipo text,
  categoria text,
  origem text,
  status text,
  data_inicio timestamptz,
  responsavel_id uuid,
  cliente_id uuid,
  metadados jsonb
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
SET "TimeZone" TO 'America/Sao_Paulo'
AS $function$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_inicio date := make_date(p_ano_inicio, p_mes_inicio, 1);
  v_fim date := (
    make_date(p_ano_inicio, p_mes_inicio, 1)
    + (GREATEST(p_meses, 1) || ' months')::interval
  )::date;
  v_year integer;
  v_month date;
  v_date date;
  r public.agenda_padroes_eventos%ROWTYPE;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa atual nao encontrada.';
  END IF;

  FOR r IN
    SELECT *
    FROM public.agenda_padroes_eventos
    WHERE empresa_id = v_empresa_id
      AND ativo = true
    ORDER BY ordem, titulo
  LOOP
    IF r.regra_tipo = 'fixa' THEN
      IF r.mes IS NULL OR r.dia IS NULL THEN
        CONTINUE;
      END IF;

      FOR v_year IN
        SELECT generate_series(
          extract(year FROM v_inicio)::integer,
          extract(year FROM (v_fim - 1))::integer
        )
      LOOP
        v_date := make_date(
          v_year,
          r.mes,
          LEAST(
            r.dia,
            extract(
              day FROM (
                make_date(v_year, r.mes, 1) + interval '1 month - 1 day'
              )
            )::integer
          )
        );

        IF v_date >= v_inicio AND v_date < v_fim THEN
          id := 'global:' || r.codigo || ':' || to_char(v_date, 'YYYY-MM-DD');
          titulo := r.titulo;
          descricao := r.descricao;
          tipo := r.tipo;
          categoria := r.categoria;
          origem := 'padrao';
          status := 'agendado';
          data_inicio := (v_date + r.hora)::timestamptz;
          responsavel_id := NULL;
          cliente_id := NULL;
          metadados := jsonb_build_object(
            'padraoId', r.id,
            'codigo', r.codigo,
            'escopo', r.escopo
          );
          RETURN NEXT;
        END IF;
      END LOOP;
    ELSIF r.regra_tipo = 'pascoa_offset' THEN
      FOR v_year IN
        SELECT generate_series(
          extract(year FROM v_inicio)::integer,
          extract(year FROM (v_fim - 1))::integer
        )
      LOOP
        v_date := public.agenda_easter_date(v_year)
          + COALESCE(r.offset_dias, 0);

        IF v_date >= v_inicio AND v_date < v_fim THEN
          id := 'global:' || r.codigo || ':' || to_char(v_date, 'YYYY-MM-DD');
          titulo := r.titulo;
          descricao := r.descricao;
          tipo := r.tipo;
          categoria := r.categoria;
          origem := 'padrao';
          status := 'agendado';
          data_inicio := (v_date + r.hora)::timestamptz;
          responsavel_id := NULL;
          cliente_id := NULL;
          metadados := jsonb_build_object(
            'padraoId', r.id,
            'codigo', r.codigo,
            'escopo', r.escopo
          );
          RETURN NEXT;
        END IF;
      END LOOP;
    ELSE
      FOR v_month IN
        SELECT generate_series(
          v_inicio,
          v_fim - 1,
          interval '1 month'
        )::date
      LOOP
        IF cardinality(r.meses) > 0
           AND NOT (
             extract(month FROM v_month)::integer = ANY(r.meses)
           ) THEN
          CONTINUE;
        END IF;

        IF r.mes IS NOT NULL
           AND r.mes <> extract(month FROM v_month)::integer THEN
          CONTINUE;
        END IF;

        IF r.regra_tipo = 'ultimo_dia_util' THEN
          v_date := public.agenda_last_business_day(
            extract(year FROM v_month)::integer,
            extract(month FROM v_month)::integer
          );
        ELSE
          v_date := make_date(
            extract(year FROM v_month)::integer,
            extract(month FROM v_month)::integer,
            LEAST(
              COALESCE(r.dia, 1),
              extract(
                day FROM (
                  date_trunc('month', v_month)::date
                  + interval '1 month - 1 day'
                )
              )::integer
            )
          );
        END IF;

        IF v_date >= v_inicio AND v_date < v_fim THEN
          id := 'global:' || r.codigo || ':' || to_char(v_date, 'YYYY-MM-DD');
          titulo := r.titulo;
          descricao := r.descricao;
          tipo := r.tipo;
          categoria := r.categoria;
          origem := 'padrao';
          status := 'agendado';
          data_inicio := (v_date + r.hora)::timestamptz;
          responsavel_id := NULL;
          cliente_id := NULL;
          metadados := jsonb_build_object(
            'padraoId', r.id,
            'codigo', r.codigo,
            'escopo', r.escopo
          );
          RETURN NEXT;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.listar_agenda_padroes_ocorrencias(integer, integer, integer) IS
  'Lista somente padrões que a empresa configurou; não cria dados ao abrir a agenda.';
