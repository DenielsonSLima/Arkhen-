-- A execução ajustada para dia útil não pode substituir a data-base canônica.
-- A inferência legada só é aplicada quando exclusivamente proxima_execucao mudou.

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
       AND NEW.proxima_execucao_base IS NOT DISTINCT FROM OLD.proxima_execucao_base
       AND NEW.frequencia IS NOT DISTINCT FROM OLD.frequencia
       AND NEW.intervalo_dias IS NOT DISTINCT FROM OLD.intervalo_dias
       AND NEW.data_ancora IS NOT DISTINCT FROM OLD.data_ancora
       AND NEW.dia_mes IS NOT DISTINCT FROM OLD.dia_mes
       AND NEW.dia_semana_iso IS NOT DISTINCT FROM OLD.dia_semana_iso
       AND NEW.incluir_finais_de_semana IS NOT DISTINCT FROM OLD.incluir_finais_de_semana THEN
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
    dia_semana_iso,
    incluir_finais_de_semana
  ON public.atividades_rotinas
  FOR EACH ROW
  EXECUTE FUNCTION app_private.normalizar_agenda_rotina_trigger();
