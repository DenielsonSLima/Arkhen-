-- Padroes editaveis da agenda por escritorio.

CREATE TABLE IF NOT EXISTS public.agenda_padroes_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo varchar(90) NOT NULL,
  titulo varchar(180) NOT NULL,
  descricao text NOT NULL DEFAULT '',
  tipo varchar(40) NOT NULL DEFAULT 'data_especial',
  categoria varchar(80) NOT NULL DEFAULT 'data_comemorativa',
  escopo varchar(40) NOT NULL DEFAULT 'brasil',
  regra_tipo varchar(40) NOT NULL DEFAULT 'fixa'
    CHECK (regra_tipo IN ('fixa', 'pascoa_offset', 'mensal_dia', 'ultimo_dia_util')),
  mes integer CHECK (mes BETWEEN 1 AND 12),
  dia integer CHECK (dia BETWEEN 1 AND 31),
  meses integer[] NOT NULL DEFAULT '{}',
  offset_dias integer,
  hora time NOT NULL DEFAULT '00:00',
  ativo boolean NOT NULL DEFAULT true,
  editavel boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_agenda_padroes_eventos_empresa_ordem
  ON public.agenda_padroes_eventos (empresa_id, ativo, ordem, titulo);

DROP TRIGGER IF EXISTS set_agenda_padroes_eventos_updated_at ON public.agenda_padroes_eventos;
CREATE TRIGGER set_agenda_padroes_eventos_updated_at
  BEFORE UPDATE ON public.agenda_padroes_eventos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agenda_padroes_eventos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.agenda_current_user_can_manage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfis p
    WHERE p.user_id = auth.uid()
      AND p.empresa_id = public.current_empresa_id()
      AND p.ativo = true
      AND p.papel IN ('admin', 'contador')
  )
  OR EXISTS (
    SELECT 1
    FROM public.configuracoes_usuarios u
    WHERE u.empresa_id = public.current_empresa_id()
      AND u.auth_user_id = auth.uid()
      AND u.status = 'Ativo'
      AND lower(u.perfil) IN ('gestor', 'administrador')
  );
$$;

DROP POLICY IF EXISTS agenda_padroes_eventos_select_policy ON public.agenda_padroes_eventos;
CREATE POLICY agenda_padroes_eventos_select_policy ON public.agenda_padroes_eventos
  FOR SELECT TO authenticated
  USING (public.is_empresa_member(empresa_id));

DROP POLICY IF EXISTS agenda_padroes_eventos_write_policy ON public.agenda_padroes_eventos;
CREATE POLICY agenda_padroes_eventos_write_policy ON public.agenda_padroes_eventos
  FOR ALL TO authenticated
  USING (public.is_empresa_member(empresa_id) AND public.agenda_current_user_can_manage())
  WITH CHECK (public.is_empresa_member(empresa_id) AND public.agenda_current_user_can_manage());

CREATE OR REPLACE FUNCTION public.agenda_seed_padroes_eventos(p_empresa_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := COALESCE(p_empresa_id, public.current_empresa_id());
BEGIN
  IF v_empresa_id IS NULL OR NOT public.is_empresa_member(v_empresa_id) THEN
    RAISE EXCEPTION 'Acesso nao autorizado aos padroes da agenda.';
  END IF;

  INSERT INTO public.agenda_padroes_eventos
    (empresa_id, codigo, titulo, descricao, tipo, categoria, escopo, regra_tipo, mes, dia, meses, offset_dias, hora, ordem)
  VALUES
    (v_empresa_id, 'feriado-confraternizacao', 'Confraternização Universal', '', 'feriado', 'feriado_nacional', 'brasil', 'fixa', 1, 1, '{}', NULL, '00:00', 10),
    (v_empresa_id, 'feriado-tiradentes', 'Tiradentes', '', 'feriado', 'feriado_nacional', 'brasil', 'fixa', 4, 21, '{}', NULL, '00:00', 20),
    (v_empresa_id, 'feriado-trabalhador', 'Dia do Trabalhador', '', 'feriado', 'feriado_nacional', 'brasil', 'fixa', 5, 1, '{}', NULL, '00:00', 30),
    (v_empresa_id, 'feriado-independencia', 'Independência do Brasil', '', 'feriado', 'feriado_nacional', 'brasil', 'fixa', 9, 7, '{}', NULL, '00:00', 40),
    (v_empresa_id, 'feriado-aparecida', 'Nossa Senhora Aparecida', '', 'feriado', 'feriado_nacional', 'brasil', 'fixa', 10, 12, '{}', NULL, '00:00', 50),
    (v_empresa_id, 'feriado-finados', 'Finados', '', 'feriado', 'feriado_nacional', 'brasil', 'fixa', 11, 2, '{}', NULL, '00:00', 60),
    (v_empresa_id, 'feriado-republica', 'Proclamação da República', '', 'feriado', 'feriado_nacional', 'brasil', 'fixa', 11, 15, '{}', NULL, '00:00', 70),
    (v_empresa_id, 'feriado-consciencia-negra', 'Consciência Negra', '', 'feriado', 'feriado_nacional', 'brasil', 'fixa', 11, 20, '{}', NULL, '00:00', 80),
    (v_empresa_id, 'feriado-natal', 'Natal', '', 'feriado', 'feriado_nacional', 'brasil', 'fixa', 12, 25, '{}', NULL, '00:00', 90),
    (v_empresa_id, 'carnaval-segunda', 'Carnaval - segunda-feira', '', 'data_especial', 'ponto_facultativo', 'brasil', 'pascoa_offset', NULL, NULL, '{}', -48, '00:00', 100),
    (v_empresa_id, 'carnaval-terca', 'Carnaval - terça-feira', '', 'data_especial', 'ponto_facultativo', 'brasil', 'pascoa_offset', NULL, NULL, '{}', -47, '00:00', 110),
    (v_empresa_id, 'quarta-cinzas', 'Quarta-feira de Cinzas', '', 'data_especial', 'ponto_facultativo', 'brasil', 'pascoa_offset', NULL, NULL, '{}', -46, '00:00', 120),
    (v_empresa_id, 'sexta-feira-santa', 'Sexta-feira Santa', '', 'feriado', 'feriado_nacional', 'brasil', 'pascoa_offset', NULL, NULL, '{}', -2, '00:00', 130),
    (v_empresa_id, 'pascoa', 'Páscoa', '', 'data_especial', 'data_comemorativa', 'brasil', 'pascoa_offset', NULL, NULL, '{}', 0, '00:00', 140),
    (v_empresa_id, 'corpus-christi', 'Corpus Christi', '', 'data_especial', 'ponto_facultativo', 'brasil', 'pascoa_offset', NULL, NULL, '{}', 60, '00:00', 150),
    (v_empresa_id, 'sergipe-emancipacao', 'Emancipação Política de Sergipe', '', 'feriado', 'feriado_sergipe', 'sergipe', 'fixa', 7, 8, '{}', NULL, '00:00', 160),
    (v_empresa_id, 'aracaju-aniversario', 'Aniversário de Aracaju', '', 'data_especial', 'data_sergipe', 'sergipe', 'fixa', 3, 17, '{}', NULL, '00:00', 170),
    (v_empresa_id, 'sao-joao', 'São João', '', 'data_especial', 'data_sergipe', 'sergipe', 'fixa', 6, 24, '{}', NULL, '00:00', 180),
    (v_empresa_id, 'dia-contabilidade', 'Dia da Contabilidade', '', 'data_especial', 'data_contabil', 'contabil', 'fixa', 4, 25, '{}', NULL, '00:00', 190),
    (v_empresa_id, 'dia-contador', 'Dia do Contador', '', 'data_especial', 'data_contabil', 'contabil', 'fixa', 9, 22, '{}', NULL, '00:00', 200),
    (v_empresa_id, 'documentos-mensais', 'Solicitar documentos mensais dos clientes', 'Notas, extratos, XMLs e comprovantes para fechamento contábil.', 'prazo_fiscal', 'obrigacao_contabil', 'contabil', 'mensal_dia', NULL, 5, '{}', NULL, '09:00', 300),
    (v_empresa_id, 'fechamento-contabil', 'Conferência contábil mensal', 'Conciliação, revisão de lançamentos e pendências do fechamento.', 'prazo_fiscal', 'obrigacao_contabil', 'contabil', 'mensal_dia', NULL, 10, '{}', NULL, '09:00', 310),
    (v_empresa_id, 'esocial', 'eSocial - eventos periódicos', 'Prazo operacional padrão para fechamento da folha e eventos mensais.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'mensal_dia', NULL, 15, '{}', NULL, '09:00', 320),
    (v_empresa_id, 'efd-reinf', 'EFD-Reinf', 'Apuração e transmissão de retenções e informações fiscais mensais.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'mensal_dia', NULL, 15, '{}', NULL, '09:00', 330),
    (v_empresa_id, 'sped-contribuicoes', 'SPED Contribuições', 'Rotina mensal de PIS/COFINS para empresas obrigadas.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'mensal_dia', NULL, 15, '{}', NULL, '09:00', 340),
    (v_empresa_id, 'pgdas-das', 'PGDAS-D / DAS', 'Apuração e guia do Simples Nacional.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'mensal_dia', NULL, 20, '{}', NULL, '09:00', 350),
    (v_empresa_id, 'sped-fiscal', 'SPED Fiscal', 'Escrituração fiscal ICMS/IPI quando aplicável.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'mensal_dia', NULL, 20, '{}', NULL, '09:00', 360),
    (v_empresa_id, 'fgts-digital', 'FGTS Digital', 'Geração e conferência da guia mensal do FGTS.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'mensal_dia', NULL, 20, '{}', NULL, '09:00', 370),
    (v_empresa_id, 'dctfweb', 'DCTFWeb', 'Conferência e transmissão da declaração mensal.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'mensal_dia', NULL, 25, '{}', NULL, '09:00', 380),
    (v_empresa_id, 'irpj-csll-trimestral', 'IRPJ/CSLL trimestral', 'Apuração trimestral e recolhimento no mês subsequente ao trimestre encerrado.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'ultimo_dia_util', NULL, NULL, ARRAY[1,4,7,10], NULL, '09:00', 390),
    (v_empresa_id, 'defis', 'DEFIS', 'Declaração anual do Simples Nacional, quando aplicável.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'mensal_dia', 3, 31, '{}', NULL, '09:00', 400),
    (v_empresa_id, 'ecd', 'ECD', 'Escrituração Contábil Digital anual, quando aplicável.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'ultimo_dia_util', NULL, NULL, ARRAY[6], NULL, '09:00', 410),
    (v_empresa_id, 'ecf', 'ECF', 'Escrituração Contábil Fiscal anual, quando aplicável.', 'prazo_fiscal', 'obrigacao_contabil', 'brasil', 'ultimo_dia_util', NULL, NULL, ARRAY[7], NULL, '09:00', 420)
  ON CONFLICT (empresa_id, codigo) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_easter_date(p_year integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  a integer := p_year % 19;
  b integer := floor(p_year / 100);
  c integer := p_year % 100;
  d integer := floor(b / 4);
  e integer := b % 4;
  f integer := floor((b + 8) / 25);
  g integer := floor((b - f + 1) / 3);
  h integer := (19 * a + b - d - g + 15) % 30;
  i integer := floor(c / 4);
  k integer := c % 4;
  l integer := (32 + 2 * e + 2 * i - h - k) % 7;
  m integer := floor((a + 11 * h + 22 * l) / 451);
  v_month integer := floor((h + l - 7 * m + 114) / 31);
  v_day integer := ((h + l - 7 * m + 114) % 31) + 1;
BEGIN
  RETURN make_date(p_year, v_month, v_day);
END;
$$;

CREATE OR REPLACE FUNCTION public.agenda_last_business_day(p_year integer, p_month integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
BEGIN
  WHILE extract(dow FROM v_date) IN (0, 6) LOOP
    v_date := v_date - 1;
  END LOOP;
  RETURN v_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_agenda_padroes_eventos()
RETURNS TABLE (
  id uuid,
  codigo varchar,
  titulo varchar,
  descricao text,
  tipo varchar,
  categoria varchar,
  escopo varchar,
  regra_tipo varchar,
  mes integer,
  dia integer,
  meses integer[],
  offset_dias integer,
  hora text,
  ativo boolean,
  editavel boolean,
  ordem integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa atual nao encontrada.';
  END IF;

  PERFORM public.agenda_seed_padroes_eventos(v_empresa_id);

  RETURN QUERY
  SELECT
    p.id, p.codigo, p.titulo, p.descricao, p.tipo, p.categoria, p.escopo,
    p.regra_tipo, p.mes, p.dia, p.meses, p.offset_dias,
    to_char(p.hora, 'HH24:MI')::text,
    p.ativo, p.editavel, p.ordem
  FROM public.agenda_padroes_eventos p
  WHERE p.empresa_id = v_empresa_id
  ORDER BY p.ordem, p.titulo;
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_agenda_padroes_eventos(p_itens jsonb)
RETURNS SETOF public.agenda_padroes_eventos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_item jsonb;
  v_codigo text;
BEGIN
  IF v_empresa_id IS NULL OR NOT public.agenda_current_user_can_manage() THEN
    RAISE EXCEPTION 'Somente gestor pode alterar padroes da agenda.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb))
  LOOP
    v_codigo := COALESCE(NULLIF(v_item->>'codigo', ''), 'custom-' || replace(gen_random_uuid()::text, '-', ''));

    INSERT INTO public.agenda_padroes_eventos (
      empresa_id, codigo, titulo, descricao, tipo, categoria, escopo, regra_tipo,
      mes, dia, meses, offset_dias, hora, ativo, editavel, ordem
    )
    VALUES (
      v_empresa_id,
      v_codigo,
      COALESCE(NULLIF(v_item->>'titulo', ''), 'Novo padrão'),
      COALESCE(v_item->>'descricao', ''),
      COALESCE(NULLIF(v_item->>'tipo', ''), 'data_especial'),
      COALESCE(NULLIF(v_item->>'categoria', ''), 'data_comemorativa'),
      COALESCE(NULLIF(v_item->>'escopo', ''), 'contabil'),
      COALESCE(NULLIF(v_item->>'regra_tipo', ''), 'fixa'),
      NULLIF(v_item->>'mes', '')::integer,
      NULLIF(v_item->>'dia', '')::integer,
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item->'meses', '[]'::jsonb))::integer),
        '{}'
      ),
      NULLIF(v_item->>'offset_dias', '')::integer,
      COALESCE(NULLIF(v_item->>'hora', '')::time, '00:00'::time),
      COALESCE((v_item->>'ativo')::boolean, true),
      COALESCE((v_item->>'editavel')::boolean, true),
      COALESCE(NULLIF(v_item->>'ordem', '')::integer, 100)
    )
    ON CONFLICT (empresa_id, codigo) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      descricao = EXCLUDED.descricao,
      tipo = EXCLUDED.tipo,
      categoria = EXCLUDED.categoria,
      escopo = EXCLUDED.escopo,
      regra_tipo = EXCLUDED.regra_tipo,
      mes = EXCLUDED.mes,
      dia = EXCLUDED.dia,
      meses = EXCLUDED.meses,
      offset_dias = EXCLUDED.offset_dias,
      hora = EXCLUDED.hora,
      ativo = EXCLUDED.ativo,
      editavel = EXCLUDED.editavel,
      ordem = EXCLUDED.ordem,
      updated_at = now();
  END LOOP;

  RETURN QUERY
  SELECT *
  FROM public.agenda_padroes_eventos
  WHERE empresa_id = v_empresa_id
  ORDER BY ordem, titulo;
END;
$$;

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
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_inicio date := make_date(p_ano_inicio, p_mes_inicio, 1);
  v_fim date := (make_date(p_ano_inicio, p_mes_inicio, 1) + (GREATEST(p_meses, 1) || ' months')::interval)::date;
  v_year integer;
  v_month date;
  v_date date;
  r public.agenda_padroes_eventos%ROWTYPE;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa atual nao encontrada.';
  END IF;

  PERFORM public.agenda_seed_padroes_eventos(v_empresa_id);

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

      FOR v_year IN SELECT generate_series(extract(year FROM v_inicio)::integer, extract(year FROM (v_fim - 1))::integer)
      LOOP
        v_date := make_date(v_year, r.mes, LEAST(r.dia, extract(day FROM (make_date(v_year, r.mes, 1) + interval '1 month - 1 day'))::integer));
        IF v_date >= v_inicio AND v_date < v_fim THEN
          id := 'global:' || r.codigo || ':' || to_char(v_date, 'YYYY-MM-DD');
          titulo := r.titulo; descricao := r.descricao; tipo := r.tipo; categoria := r.categoria;
          origem := 'padrao'; status := 'agendado'; data_inicio := (v_date + r.hora)::timestamptz;
          responsavel_id := NULL; cliente_id := NULL;
          metadados := jsonb_build_object('padraoId', r.id, 'codigo', r.codigo, 'escopo', r.escopo);
          RETURN NEXT;
        END IF;
      END LOOP;
    ELSIF r.regra_tipo = 'pascoa_offset' THEN
      FOR v_year IN SELECT generate_series(extract(year FROM v_inicio)::integer, extract(year FROM (v_fim - 1))::integer)
      LOOP
        v_date := public.agenda_easter_date(v_year) + COALESCE(r.offset_dias, 0);
        IF v_date >= v_inicio AND v_date < v_fim THEN
          id := 'global:' || r.codigo || ':' || to_char(v_date, 'YYYY-MM-DD');
          titulo := r.titulo; descricao := r.descricao; tipo := r.tipo; categoria := r.categoria;
          origem := 'padrao'; status := 'agendado'; data_inicio := (v_date + r.hora)::timestamptz;
          responsavel_id := NULL; cliente_id := NULL;
          metadados := jsonb_build_object('padraoId', r.id, 'codigo', r.codigo, 'escopo', r.escopo);
          RETURN NEXT;
        END IF;
      END LOOP;
    ELSE
      FOR v_month IN SELECT generate_series(v_inicio, v_fim - 1, interval '1 month')::date
      LOOP
        IF cardinality(r.meses) > 0 AND NOT (extract(month FROM v_month)::integer = ANY(r.meses)) THEN
          CONTINUE;
        END IF;
        IF r.mes IS NOT NULL AND r.mes <> extract(month FROM v_month)::integer THEN
          CONTINUE;
        END IF;

        IF r.regra_tipo = 'ultimo_dia_util' THEN
          v_date := public.agenda_last_business_day(extract(year FROM v_month)::integer, extract(month FROM v_month)::integer);
        ELSE
          v_date := make_date(
            extract(year FROM v_month)::integer,
            extract(month FROM v_month)::integer,
            LEAST(COALESCE(r.dia, 1), extract(day FROM (date_trunc('month', v_month)::date + interval '1 month - 1 day'))::integer)
          );
        END IF;

        IF v_date >= v_inicio AND v_date < v_fim THEN
          id := 'global:' || r.codigo || ':' || to_char(v_date, 'YYYY-MM-DD');
          titulo := r.titulo; descricao := r.descricao; tipo := r.tipo; categoria := r.categoria;
          origem := 'padrao'; status := 'agendado'; data_inicio := (v_date + r.hora)::timestamptz;
          responsavel_id := NULL; cliente_id := NULL;
          metadados := jsonb_build_object('padraoId', r.id, 'codigo', r.codigo, 'escopo', r.escopo);
          RETURN NEXT;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.agenda_current_user_can_manage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agenda_seed_padroes_eventos(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_agenda_padroes_eventos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salvar_agenda_padroes_eventos(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_agenda_padroes_ocorrencias(integer, integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.agenda_current_user_can_manage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_agenda_padroes_eventos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_agenda_padroes_eventos(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_agenda_padroes_ocorrencias(integer, integer, integer) TO authenticated;
