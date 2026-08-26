-- Consolida o resumo operacional do Inicio no banco. A funcao e invoker para
-- que as policies RLS de cada origem continuem definindo o conjunto visivel.
BEGIN;

-- A função histórica compõe `date + time` antes do cast para timestamptz.
-- Fixar o GUC nela garante que 00:00 civil de São Paulo não seja interpretado
-- como UTC e convertido para 21:00 do dia anterior.
ALTER FUNCTION public.listar_agenda_padroes_ocorrencias(integer, integer, integer)
  SET timezone TO 'America/Sao_Paulo';

CREATE OR REPLACE FUNCTION public.obter_resumo_inicio()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
SET row_security = on
AS $$
DECLARE
  v_empresa_id uuid := public.current_empresa_id();
  v_hoje date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_fim_semana date := v_hoje + 6;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL
     OR v_empresa_id IS NULL
     OR NOT public.current_user_access_allowed(v_empresa_id) THEN
    RAISE EXCEPTION 'Sessao sem acesso ao resumo operacional.' USING ERRCODE = '42501';
  END IF;

  WITH
  tarefas_visiveis AS MATERIALIZED (
    SELECT tarefa.*
    FROM public.atividades_tarefas tarefa
    WHERE tarefa.empresa_id = v_empresa_id
      AND tarefa.ativo = true
      AND public.current_user_can_access_client_row(tarefa.empresa_id, tarefa.cliente_id)
      AND (
        public.current_user_has_permission(tarefa.empresa_id, 'atividades:manage')
        OR (
          public.current_user_has_permission(tarefa.empresa_id, 'atividades:view')
          AND tarefa.responsavel_user_id = auth.uid()
        )
        OR (
          tarefa.cliente_id IS NOT NULL
          AND public.current_user_has_permission(tarefa.empresa_id, 'atividades:view-own')
          AND public.current_user_has_client_access(tarefa.empresa_id, tarefa.cliente_id)
        )
      )
  ),
  tarefas AS MATERIALIZED (
    SELECT
      tarefa.*,
      jsonb_build_object(
        'id', tarefa.id,
        'rotinaId', tarefa.rotina_id,
        'clienteId', tarefa.cliente_id,
        'titulo', tarefa.titulo,
        'categoria', COALESCE(tarefa.categoria, 'Cliente'),
        'frequencia', COALESCE(tarefa.frequencia, 'Única'),
        'responsavel', COALESCE(tarefa.responsavel_nome, ''),
        'responsavelUserId', tarefa.responsavel_user_id,
        'responsavelConfigUsuarioId', tarefa.responsavel_config_usuario_id,
        'cliente', COALESCE(NULLIF(btrim(tarefa.cliente_nome), ''), 'Escritório'),
        'vencimento', to_char(tarefa.vencimento, 'YYYY-MM-DD'),
        'prioridade', COALESCE(tarefa.prioridade, 'Média'),
        'status', COALESCE(tarefa.status, 'Pendente'),
        'origem', COALESCE(tarefa.origem, 'Manual'),
        'checklist', COALESCE(tarefa.checklist, '[]'::jsonb),
        'notas', COALESCE(tarefa.notas, ''),
        'dataHoraConclusao', tarefa.data_hora_conclusao,
        'observacaoFalta', tarefa.observacao_falta
      ) AS item
    FROM tarefas_visiveis tarefa
  ),
  clientes_ativos AS MATERIALIZED (
    SELECT cliente.id, cliente.nome, cliente.certificados
    FROM public.clientes cliente
    WHERE cliente.empresa_id = v_empresa_id
      AND cliente.status = 'Ativa'
      AND public.current_user_can_access_client_row(cliente.empresa_id, cliente.id)
      AND (
        public.current_user_has_permission(cliente.empresa_id, 'clientes:view')
        OR public.current_user_has_client_access(cliente.empresa_id, cliente.id)
      )
  ),
  agenda_manual AS (
    SELECT
      (evento.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date AS data_evento,
      jsonb_build_object(
        'id', evento.id,
        'titulo', evento.titulo,
        'descricao', COALESCE(evento.descricao, ''),
        'data', to_char(evento.data_inicio AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'),
        'hora', to_char(evento.data_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
        'tipo', evento.tipo,
        'categoriaId', evento.categoria,
        'empresaId', evento.cliente_id,
        'empresaNome', COALESCE(
          evento.metadados ->> 'empresaNome', evento.metadados ->> 'clienteNome'
        ),
        'concluido', evento.status = 'concluido',
        'responsavelId', COALESCE(
          evento.responsavel_id::text, evento.metadados ->> 'responsavelId'
        ),
        'responsavelNome', evento.metadados ->> 'responsavelNome',
        'responsavelPerfil', evento.metadados ->> 'responsavelPerfil'
      ) AS item
    FROM public.agenda_eventos evento
    WHERE evento.empresa_id = v_empresa_id
      AND evento.ativo = true
      AND (evento.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date
        BETWEEN v_hoje AND v_fim_semana
      AND public.current_user_can_access_client_row(evento.empresa_id, evento.cliente_id)
      AND (
        public.current_user_has_permission(evento.empresa_id, 'agenda:manage')
        OR (
          public.current_user_has_permission(evento.empresa_id, 'agenda:view')
          AND EXISTS (
            SELECT 1
            FROM public.agenda_responsaveis responsavel
            WHERE responsavel.id = evento.responsavel_id
              AND responsavel.empresa_id = evento.empresa_id
              AND responsavel.user_id = auth.uid()
              AND responsavel.ativo = true
          )
        )
      )
  ),
  agenda_tarefas AS (
    SELECT
      tarefa.vencimento AS data_evento,
      jsonb_build_object(
        'id', 'atividade:' || tarefa.id::text,
        'titulo', '[Atividade] ' || tarefa.titulo,
        'descricao', '',
        'data', to_char(tarefa.vencimento, 'YYYY-MM-DD'),
        'tipo', 'tarefa',
        'categoriaId', 'operacional',
        'empresaId', tarefa.cliente_id,
        'empresaNome', tarefa.cliente_nome,
        'concluido', tarefa.status = 'Concluída',
        'responsavelId', COALESCE(tarefa.responsavel_user_id::text, tarefa.responsavel_nome),
        'responsavelNome', tarefa.responsavel_nome
      ) AS item
    FROM tarefas_visiveis tarefa
    WHERE tarefa.vencimento BETWEEN v_hoje AND v_fim_semana
  ),
  agenda_padroes AS (
    SELECT
      (padrao.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date AS data_evento,
      jsonb_build_object(
        'id', padrao.id,
        'titulo', padrao.titulo,
        'descricao', COALESCE(padrao.descricao, ''),
        'data', to_char(padrao.data_inicio AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD'),
        'hora', to_char(padrao.data_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI'),
        'tipo', padrao.tipo,
        'categoriaId', padrao.categoria,
        'concluido', false
      ) AS item
    FROM public.listar_agenda_padroes_ocorrencias(
      extract(year FROM v_hoje)::integer,
      extract(month FROM v_hoje)::integer,
      2
    ) padrao
    WHERE (padrao.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date
      BETWEEN v_hoje AND v_fim_semana
      AND (
        public.current_user_has_permission(v_empresa_id, 'agenda:manage')
        OR public.current_user_has_permission(v_empresa_id, 'agenda:view')
        OR public.current_user_has_permission(v_empresa_id, 'agenda:view-own')
      )
  ),
  agenda_itens AS MATERIALIZED (
    SELECT * FROM agenda_manual
    UNION ALL SELECT * FROM agenda_tarefas
    UNION ALL SELECT * FROM agenda_padroes
  ),
  alertas_documentos AS (
    SELECT
      'doc-' || documento.id::text AS id,
      documento.data_validade - v_hoje AS dias_restantes,
      jsonb_build_object(
        'id', 'doc-' || documento.id::text,
        'empresaNome', CASE
          WHEN documento.cliente_id IS NULL THEN 'Escritório'
          ELSE COALESCE(cliente.nome, 'Cliente não encontrado')
        END,
        'tipo', 'documento',
        'nome', documento.nome,
        'dataValidade', to_char(documento.data_validade, 'DD/MM/YYYY'),
        'diasRestantes', documento.data_validade - v_hoje
      ) AS item
    FROM public.documentos documento
    LEFT JOIN clientes_ativos cliente ON cliente.id::text = documento.cliente_id
    WHERE documento.empresa_id = v_empresa_id
      AND documento.data_validade IS NOT NULL
      AND documento.data_validade <= v_hoje + 15
      AND public.current_user_can_access_client_row(documento.empresa_id, documento.cliente_id)
      AND (
        public.current_user_has_permission(documento.empresa_id, 'documentos:view')
        OR public.current_user_has_permission(documento.empresa_id, 'documentos:manage')
        OR public.current_user_has_permission(documento.empresa_id, 'documentos:view-own')
      )
  ),
  certificados_fonte AS (
    SELECT
      cliente.id AS cliente_id,
      cliente.nome AS cliente_nome,
      certificado.item,
      CASE
        WHEN certificado.item ->> 'dataValidade'
          ~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])$'
          THEN to_date(certificado.item ->> 'dataValidade', 'YYYY-MM-DD')
        ELSE NULL
      END AS data_validade
    FROM clientes_ativos cliente
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(cliente.certificados) = 'array' THEN cliente.certificados
        ELSE '[]'::jsonb
      END
    ) certificado(item)
    WHERE jsonb_typeof(certificado.item) = 'object'
  ),
  alertas_certificados AS (
    SELECT
      'cert-' || COALESCE(
        NULLIF(certificado.item ->> 'id', ''),
        certificado.cliente_id::text || '-' || to_char(certificado.data_validade, 'YYYY-MM-DD')
      ) AS id,
      certificado.data_validade - v_hoje AS dias_restantes,
      jsonb_build_object(
        'id', 'cert-' || COALESCE(
          NULLIF(certificado.item ->> 'id', ''),
          certificado.cliente_id::text || '-' || to_char(certificado.data_validade, 'YYYY-MM-DD')
        ),
        'empresaNome', COALESCE(NULLIF(btrim(certificado.cliente_nome), ''), 'Cliente sem nome'),
        'tipo', 'certificado',
        'nome', COALESCE(NULLIF(certificado.item ->> 'tipo', ''), 'Certificado digital')
          || ' - ' || COALESCE(
            NULLIF(certificado.item ->> 'titular', ''),
            NULLIF(btrim(certificado.cliente_nome), ''),
            'Cliente'
          ),
        'dataValidade', to_char(certificado.data_validade, 'DD/MM/YYYY'),
        'diasRestantes', certificado.data_validade - v_hoje
      ) AS item
    FROM certificados_fonte certificado
    WHERE certificado.data_validade IS NOT NULL
      AND to_char(certificado.data_validade, 'YYYY-MM-DD')
        = certificado.item ->> 'dataValidade'
      AND certificado.data_validade <= v_hoje + 15
  ),
  alertas AS MATERIALIZED (
    SELECT * FROM alertas_documentos
    UNION ALL SELECT * FROM alertas_certificados
  ),
  configuracoes_ranqueadas AS (
    SELECT
      usuario.id,
      usuario.auth_user_id,
      usuario.nome,
      row_number() OVER (
        PARTITION BY COALESCE('auth:' || usuario.auth_user_id::text, 'config:' || usuario.id::text)
        ORDER BY (usuario.perfil_id IS NOT NULL) DESC, usuario.id
      ) AS posicao
    FROM public.configuracoes_usuarios usuario
    WHERE usuario.empresa_id = v_empresa_id
      AND usuario.status = 'Ativo'
      AND (
        usuario.auth_user_id = auth.uid()
        OR public.current_user_has_permission(usuario.empresa_id, 'usuarios:manage')
      )
  ),
  configuracoes_usuarios AS MATERIALIZED (
    SELECT id, auth_user_id, nome
    FROM configuracoes_ranqueadas
    WHERE posicao = 1
  ),
  responsaveis_tarefas AS (
    SELECT DISTINCT ON (chave)
      chave,
      tarefa.responsavel_config_usuario_id AS config_usuario_id,
      tarefa.responsavel_user_id AS user_id,
      tarefa.responsavel_nome AS nome
    FROM tarefas tarefa
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN tarefa.responsavel_config_usuario_id IS NOT NULL
          THEN 'config:' || tarefa.responsavel_config_usuario_id::text
        WHEN tarefa.responsavel_user_id IS NOT NULL
          THEN 'auth:' || tarefa.responsavel_user_id::text
        ELSE 'nome:' || lower(btrim(tarefa.responsavel_nome))
      END AS chave
    ) identidade
    WHERE NULLIF(btrim(tarefa.responsavel_nome), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM configuracoes_usuarios usuario
        WHERE CASE
          WHEN tarefa.responsavel_config_usuario_id IS NOT NULL THEN
            tarefa.responsavel_config_usuario_id = usuario.id
          WHEN tarefa.responsavel_user_id IS NOT NULL AND usuario.auth_user_id IS NOT NULL THEN
            tarefa.responsavel_user_id = usuario.auth_user_id
          ELSE lower(btrim(tarefa.responsavel_nome)) = lower(btrim(usuario.nome))
        END
      )
    ORDER BY chave, tarefa.responsavel_nome
  ),
  usuarios_base AS MATERIALIZED (
    SELECT
      'config:' || usuario.id::text AS chave,
      usuario.id AS config_usuario_id,
      usuario.auth_user_id AS user_id,
      usuario.nome
    FROM configuracoes_usuarios usuario
    UNION ALL
    SELECT chave, config_usuario_id, user_id, nome FROM responsaveis_tarefas
  ),
  usuarios_metricas AS (
    SELECT
      usuario.chave,
      usuario.nome,
      count(tarefa.id)::integer AS total,
      count(tarefa.id) FILTER (WHERE tarefa.status = 'Concluída')::integer AS concluidas,
      count(tarefa.id) FILTER (
        WHERE tarefa.status <> 'Concluída' AND tarefa.vencimento < v_hoje
      )::integer AS atrasadas,
      count(tarefa.id) FILTER (WHERE tarefa.frequencia = 'Diária')::integer AS diaria_total,
      count(tarefa.id) FILTER (
        WHERE tarefa.frequencia = 'Diária' AND tarefa.status = 'Concluída'
      )::integer AS diaria_done,
      count(tarefa.id) FILTER (WHERE tarefa.frequencia IN ('Semanal', 'Quinzenal'))::integer AS semanal_total,
      count(tarefa.id) FILTER (
        WHERE tarefa.frequencia IN ('Semanal', 'Quinzenal') AND tarefa.status = 'Concluída'
      )::integer AS semanal_done,
      count(tarefa.id) FILTER (WHERE tarefa.frequencia = 'Mensal')::integer AS mensal_total,
      count(tarefa.id) FILTER (
        WHERE tarefa.frequencia = 'Mensal' AND tarefa.status = 'Concluída'
      )::integer AS mensal_done
    FROM usuarios_base usuario
    LEFT JOIN tarefas tarefa ON CASE
      WHEN tarefa.responsavel_config_usuario_id IS NOT NULL THEN
        tarefa.responsavel_config_usuario_id = usuario.config_usuario_id
      WHEN tarefa.responsavel_user_id IS NOT NULL AND usuario.user_id IS NOT NULL THEN
        tarefa.responsavel_user_id = usuario.user_id
      ELSE lower(btrim(tarefa.responsavel_nome)) = lower(btrim(usuario.nome))
    END
    GROUP BY usuario.chave, usuario.nome
  ),
  usuarios_json AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'key', metrica.chave,
      'usuario', metrica.nome,
      'total', metrica.total,
      'done', metrica.concluidas,
      'atrasadas', metrica.atrasadas,
      'pct', CASE WHEN metrica.total = 0 THEN 0
        ELSE round(metrica.concluidas * 100.0 / metrica.total)::integer END,
      'periodos', jsonb_build_object(
        'diaria', jsonb_build_object(
          'total', metrica.diaria_total, 'done', metrica.diaria_done,
          'pct', CASE WHEN metrica.diaria_total = 0 THEN 0
            ELSE round(metrica.diaria_done * 100.0 / metrica.diaria_total)::integer END
        ),
        'semanal', jsonb_build_object(
          'total', metrica.semanal_total, 'done', metrica.semanal_done,
          'pct', CASE WHEN metrica.semanal_total = 0 THEN 0
            ELSE round(metrica.semanal_done * 100.0 / metrica.semanal_total)::integer END
        ),
        'mensal', jsonb_build_object(
          'total', metrica.mensal_total, 'done', metrica.mensal_done,
          'pct', CASE WHEN metrica.mensal_total = 0 THEN 0
            ELSE round(metrica.mensal_done * 100.0 / metrica.mensal_total)::integer END
        )
      )
    ) ORDER BY metrica.nome), '[]'::jsonb) AS itens
    FROM usuarios_metricas metrica
  ),
  totais AS (
    SELECT
      count(*)::integer AS total,
      count(*) FILTER (WHERE status = 'Concluída')::integer AS concluidas,
      count(*) FILTER (WHERE status <> 'Concluída')::integer AS pendentes,
      count(*) FILTER (WHERE status <> 'Concluída' AND vencimento < v_hoje)::integer AS atrasadas,
      count(*) FILTER (WHERE status <> 'Concluída' AND vencimento = v_hoje)::integer AS vencem_hoje,
      count(*) FILTER (WHERE vencimento = v_hoje)::integer AS atividades_hoje
    FROM tarefas
  ),
  totais_alertas AS (
    SELECT
      count(*)::integer AS total,
      count(*) FILTER (WHERE dias_restantes < 0)::integer AS vencidos,
      count(*) FILTER (WHERE dias_restantes = 0)::integer AS vencem_hoje
    FROM alertas
  )
  SELECT jsonb_build_object(
    'stats', jsonb_build_object(
      'clientesAtivos', (SELECT count(*)::integer FROM clientes_ativos)
    ),
    'summary', jsonb_build_object(
      'dataReferencia', to_char(v_hoje, 'YYYY-MM-DD'),
      'tarefas', jsonb_build_object(
        'total', totais.total,
        'done', totais.concluidas,
        'pct', CASE WHEN totais.total = 0 THEN 0
          ELSE round(totais.concluidas * 100.0 / totais.total)::integer END,
        'pendentesTotal', totais.pendentes,
        'pendentes', (SELECT COALESCE(jsonb_agg(recorte.item ORDER BY recorte.vencimento, recorte.id), '[]'::jsonb)
          FROM (SELECT * FROM tarefas WHERE status <> 'Concluída' ORDER BY vencimento, id LIMIT 6) recorte),
        'atividadesHoje', (SELECT COALESCE(jsonb_agg(recorte.item ORDER BY (recorte.status = 'Concluída'), recorte.id), '[]'::jsonb)
          FROM (SELECT * FROM tarefas WHERE vencimento = v_hoje ORDER BY (status = 'Concluída'), id LIMIT 5) recorte),
        'atividadesHojeTotal', totais.atividades_hoje,
        'atrasadas', totais.atrasadas,
        'vencemHoje', totais.vencem_hoje
      ),
      'agenda', jsonb_build_object(
        'total', (SELECT count(*)::integer FROM agenda_itens),
        'hojeTotal', (SELECT count(*)::integer FROM agenda_itens WHERE data_evento = v_hoje),
        'hoje', (SELECT COALESCE(jsonb_agg(recorte.item ORDER BY recorte.data_evento, recorte.item ->> 'id'), '[]'::jsonb)
          FROM (SELECT * FROM agenda_itens WHERE data_evento = v_hoje ORDER BY data_evento, item ->> 'id' LIMIT 5) recorte),
        'semana', (SELECT COALESCE(jsonb_agg(recorte.item ORDER BY recorte.data_evento, recorte.item ->> 'id'), '[]'::jsonb)
          FROM (SELECT * FROM agenda_itens WHERE data_evento <> v_hoje ORDER BY data_evento, item ->> 'id' LIMIT 6) recorte)
      ),
      'alertas', jsonb_build_object(
        'total', totais_alertas.total,
        'vencidos', totais_alertas.vencidos,
        'vencemHoje', totais_alertas.vencem_hoje,
        'itens', (
          SELECT COALESCE(
            jsonb_agg(recorte.item ORDER BY recorte.dias_restantes, recorte.id),
            '[]'::jsonb
          )
          FROM (
            SELECT * FROM alertas
            ORDER BY dias_restantes, id
            LIMIT 50
          ) recorte
        ),
        'criticos', (SELECT COALESCE(jsonb_agg(recorte.item ORDER BY recorte.dias_restantes, recorte.id), '[]'::jsonb)
          FROM (SELECT * FROM alertas ORDER BY dias_restantes, id LIMIT 4) recorte)
      ),
      'operacao', jsonb_build_object(
        'pendenciasTotal', totais.pendentes + totais_alertas.total,
        'atrasosTotal', totais.atrasadas + totais_alertas.vencidos,
        'vencemHojeTotal', totais.vencem_hoje + totais_alertas.vencem_hoje
      ),
      'usuarios', usuarios_json.itens
    )
  ) INTO v_resultado
  FROM totais CROSS JOIN totais_alertas CROSS JOIN usuarios_json;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.obter_resumo_inicio()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.obter_resumo_inicio() TO authenticated;

COMMENT ON FUNCTION public.obter_resumo_inicio() IS
  'Resumo pronto do Inicio, calculado em America/Sao_Paulo e limitado pelas policies RLS do chamador.';

COMMIT;
