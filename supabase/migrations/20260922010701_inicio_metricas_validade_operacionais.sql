BEGIN;

CREATE OR REPLACE FUNCTION public.obter_alertas_validade_inicio()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
  v_hoje date := (current_timestamp AT TIME ZONE 'America/Sao_Paulo')::date;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL OR NOT coalesce(public.current_user_access_allowed(v_empresa),false) THEN
    RAISE EXCEPTION 'Sessão indisponível.' USING ERRCODE = '42501';
  END IF;
  WITH alertas AS (
    SELECT 'doc-' || d.id::text AS id, coalesce(c.nome, 'Biblioteca pessoal') AS empresa,
      'documento'::text AS tipo, d.nome, d.data_validade AS validade
    FROM public.documentos d
    LEFT JOIN public.clientes c ON c.id::text = d.cliente_id AND c.empresa_id = d.empresa_id
    WHERE d.empresa_id = v_empresa AND d.data_validade IS NOT NULL
      AND d.data_validade <= v_hoje + 15
    UNION ALL
    SELECT 'cert-' || c.id::text || '-' || cert.ord::text, c.nome, 'certificado',
      coalesce(cert.item->>'tipo', 'Certificado') || ' — ' || coalesce(cert.item->>'titular', c.nome),
      (cert.item->>'dataValidade')::date
    FROM public.clientes c
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c.certificados) = 'array' THEN c.certificados ELSE '[]'::jsonb END
    ) WITH ORDINALITY cert(item, ord)
    WHERE c.empresa_id = v_empresa AND c.status = 'Ativa'
      AND cert.item->>'dataValidade' ~ '^\d{4}-\d{2}-\d{2}$'
      AND CASE WHEN pg_input_is_valid(cert.item->>'dataValidade', 'date')
        THEN (cert.item->>'dataValidade')::date <= v_hoje + 15 ELSE false END
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'empresaNome', empresa, 'tipo', tipo, 'nome', nome,
    'dataValidade', to_char(validade, 'DD/MM/YYYY'), 'diasRestantes', validade - v_hoje
  ) ORDER BY validade, id), '[]'::jsonb) INTO v_resultado FROM alertas;
  RETURN v_resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.obter_alertas_validade_inicio() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_alertas_validade_inicio() TO authenticated;

CREATE OR REPLACE FUNCTION public.obter_inicio_operacional()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
  v_hoje date := (current_timestamp AT TIME ZONE 'America/Sao_Paulo')::date;
  v_tipo_cliente uuid;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL OR NOT coalesce(public.current_user_access_allowed(v_empresa),false) THEN
    RAISE EXCEPTION 'Sessão indisponível.' USING ERRCODE = '42501';
  END IF;
  v_tipo_cliente := public.obter_tipo_parceiro_cliente_contabil();
  WITH tarefas AS (
    SELECT t.*, coalesce(t.responsavel_config_usuario_id::text,
      t.responsavel_user_id::text, nullif(t.responsavel_nome, '')) AS responsavel_chave
    FROM public.atividades_tarefas t
    WHERE t.empresa_id = v_empresa AND t.ativo AND t.status <> 'Cancelada'
  ), totais AS (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE status = 'Concluída') AS done,
      count(*) FILTER (WHERE status <> 'Concluída') AS pendentes,
      count(*) FILTER (WHERE status <> 'Concluída' AND vencimento < v_hoje) AS atrasadas
    FROM tarefas
  ), periodos AS (
    SELECT responsavel_chave, p.chave,
      count(*) FILTER (WHERE frequencia = ANY(p.frequencias)) AS total,
      count(*) FILTER (WHERE frequencia = ANY(p.frequencias) AND status = 'Concluída') AS done
    FROM tarefas CROSS JOIN (VALUES
      ('diaria', ARRAY['Diária']), ('semanal', ARRAY['Semanal','Quinzenal']),
      ('mensal', ARRAY['Mensal'])
    ) p(chave,frequencias) WHERE responsavel_chave IS NOT NULL
    GROUP BY responsavel_chave,p.chave
  ), usuarios AS (
    SELECT t.responsavel_chave, coalesce(nullif(max(t.responsavel_nome), ''), 'Usuário') AS usuario, count(*) AS total,
      count(*) FILTER (WHERE t.status = 'Concluída') AS done,
      count(*) FILTER (WHERE t.status <> 'Concluída' AND t.vencimento < v_hoje) AS atrasadas,
      (SELECT jsonb_object_agg(p.chave,jsonb_build_object('total',p.total,'done',p.done,
        'pct',coalesce(round(100.0*p.done/nullif(p.total,0)),0)))
       FROM periodos p WHERE p.responsavel_chave=t.responsavel_chave) AS periodos
    FROM tarefas t WHERE t.responsavel_chave IS NOT NULL GROUP BY t.responsavel_chave
  ), agenda AS (
    SELECT (e.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date AS dia
    FROM public.agenda_eventos e WHERE e.empresa_id=v_empresa AND e.ativo
    UNION ALL SELECT vencimento FROM tarefas
    UNION ALL
    SELECT (p.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date
    FROM public.listar_agenda_padroes_ocorrencias(
      extract(year FROM v_hoje)::integer,extract(month FROM v_hoje)::integer,2) p
  )
  SELECT jsonb_build_object(
    'total', totais.total, 'done', totais.done, 'pct', coalesce(round(100.0*totais.done/nullif(totais.total,0)),0),
    'pendentes', totais.pendentes + jsonb_array_length(public.obter_alertas_validade_inicio()),
    'atrasadas', totais.atrasadas,
    'empresasAtivas', (SELECT count(*) FROM public.clientes c WHERE c.empresa_id=v_empresa
      AND c.status='Ativa' AND (v_tipo_cliente IS NULL OR c.tipo_parceiro_id=v_tipo_cliente)),
    'agendaHoje', (SELECT count(*) FROM agenda WHERE dia=v_hoje),
    'agendaSemana', (SELECT count(*) FROM agenda WHERE dia BETWEEN v_hoje AND v_hoje+6),
    'usuarios', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',responsavel_chave,'usuario',usuario,'total',total,'done',done,'atrasadas',atrasadas,
      'pct',coalesce(round(100.0*done/nullif(total,0)),0),'periodos',periodos
    ) ORDER BY usuario),'[]'::jsonb) FROM usuarios)
  ) INTO v_resultado FROM totais;
  RETURN v_resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.obter_inicio_operacional() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_inicio_operacional() TO authenticated;
COMMIT;
