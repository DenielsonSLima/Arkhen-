-- Contexto autenticado, auditoria de checklist e RPCs sujeitos a RLS.

create unique index if not exists uq_clientes_empresa_cnpj_normalizado
on public.clientes (
  empresa_id,
  regexp_replace(cnpj,'[^0-9]','','g')
)
where regexp_replace(cnpj,'[^0-9]','','g') ~ '^[0-9]{14}$'
  and regexp_replace(cnpj,'[^0-9]','','g') <> '00000000000000';

create or replace function public.current_access_context()
returns jsonb
language plpgsql
stable security definer
set search_path=public,pg_temp
as $$
declare
  v_empresa_id uuid;
  v_empresa_nome text;
  v_clientes jsonb;
  v_cliente_principal jsonb;
  v_escopo_cliente boolean;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  select p.empresa_id,e.nome
    into v_empresa_id,v_empresa_nome
  from public.perfis p
  join public.empresas e on e.id=p.empresa_id
  where p.user_id=auth.uid()
    and p.ativo=true
    and lower(e.status) in ('ativo','ativa')
  order by p.created_at
  limit 1;

  if v_empresa_id is null then
    raise exception 'Usuário sem empresa ativa';
  end if;

  v_escopo_cliente:=public.current_user_is_client_scoped(v_empresa_id);

  if v_escopo_cliente then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id',c.id,
        'nome',c.nome,
        'razaoSocial',c.razao_social,
        'cnpj',c.cnpj,
        'logo',c.logo,
        'status',c.status
      ) order by c.nome
    ),'[]'::jsonb)
    into v_clientes
    from public.cliente_usuario_acessos a
    join public.clientes c
      on c.id=a.cliente_id and c.empresa_id=a.empresa_id
    where a.auth_user_id=auth.uid()
      and a.empresa_id=v_empresa_id
      and a.status='Ativo';

    v_cliente_principal:=v_clientes->0;
  else
    v_clientes:='[]'::jsonb;
    v_cliente_principal:=null;
  end if;

  return jsonb_build_object(
    'tipo',case when v_escopo_cliente then 'cliente' else 'empresa' end,
    'empresaId',v_empresa_id,
    'empresaNome',v_empresa_nome,
    'clientePrincipal',v_cliente_principal,
    'clientes',v_clientes,
    'identidadeNome',case
      when v_escopo_cliente
        then coalesce(v_cliente_principal->>'nome',v_empresa_nome)
      else v_empresa_nome
    end,
    'identidadeLogo',case
      when v_escopo_cliente then v_cliente_principal->>'logo'
      else null
    end
  );
end;
$$;

revoke all on function public.current_access_context() from public,anon;
grant execute on function public.current_access_context()
to authenticated,service_role;

create or replace function public.atualizar_atividade_checklist(
  p_instancia_id uuid,
  p_etapa text,
  p_concluida boolean,
  p_data_hora timestamptz default now()
)
returns public.atividades_instancias
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_instancia public.atividades_instancias%rowtype;
  v_usuario text;
  v_checklists jsonb;
  v_status text;
  v_autorizado boolean;
begin
  if auth.uid() is null or nullif(trim(p_etapa),'') is null then
    raise exception 'Solicitação inválida';
  end if;

  select i.* into v_instancia
  from public.atividades_instancias i
  where i.id=p_instancia_id and i.ativo=true
  for update;

  if not found then
    raise exception 'Atividade não encontrada';
  end if;

  if not (coalesce(v_instancia.checklists,'{}'::jsonb) ? p_etapa) then
    raise exception 'Etapa inválida';
  end if;

  v_autorizado :=
    public.current_user_has_permission(
      v_instancia.empresa_id,'atividades:manage'
    )
    or (
      public.current_user_has_permission(
        v_instancia.empresa_id,'atividades:update-own'
      )
      and (
        (
          v_instancia.cliente_id is not null
          and public.current_user_has_client_access(
            v_instancia.empresa_id,v_instancia.cliente_id
          )
        )
        or exists (
          select 1 from public.atividades_tarefas t
          where t.empresa_id=v_instancia.empresa_id
            and t.cliente_id is not distinct from v_instancia.cliente_id
            and t.modelo_id is not distinct from v_instancia.modelo_id
            and t.competencia=v_instancia.competencia
            and t.responsavel_user_id=auth.uid()
            and t.ativo=true
        )
      )
    );

  if not v_autorizado then
    raise exception 'Atividade não encontrada';
  end if;

  select coalesce(
    (
      select nullif(trim(u.nome),'')
      from public.configuracoes_usuarios u
      where u.empresa_id=v_instancia.empresa_id
        and u.auth_user_id=auth.uid()
        and u.status='Ativo'
      limit 1
    ),
    (
      select nullif(trim(p.nome),'')
      from public.perfis p
      where p.empresa_id=v_instancia.empresa_id
        and p.user_id=auth.uid()
        and p.ativo=true
      limit 1
    ),
    auth.uid()::text
  ) into v_usuario;

  v_checklists:=jsonb_set(
    coalesce(v_instancia.checklists,'{}'::jsonb),
    array[p_etapa],
    to_jsonb(coalesce(p_concluida,false)),
    false
  );

  select case
    when count(*)>0 and bool_and(value::boolean) then 'Concluída'
    when bool_or(value::boolean) then 'Em andamento'
    else 'Pendente'
  end
  into v_status
  from jsonb_each(v_checklists);

  update public.atividades_instancias
  set checklists=v_checklists,
      checklist_dates=jsonb_set(
        coalesce(checklist_dates,'{}'::jsonb),
        array[p_etapa],
        case when p_concluida then to_jsonb(now())
             else 'null'::jsonb end,
        false
      ),
      checklist_users=jsonb_set(
        coalesce(checklist_users,'{}'::jsonb),
        array[p_etapa],
        case when p_concluida then to_jsonb(v_usuario)
             else 'null'::jsonb end,
        false
      ),
      status=v_status,
      atualizado_em=now()
  where id=p_instancia_id
  returning * into v_instancia;

  return v_instancia;
end;
$$;

revoke all on function public.atualizar_atividade_checklist(
  uuid,text,boolean,timestamptz
) from public,anon;
grant execute on function public.atualizar_atividade_checklist(
  uuid,text,boolean,timestamptz
) to authenticated,service_role;

-- Relatórios e operações passam a executar como o usuário autenticado,
-- permitindo que as políticas RLS sejam aplicadas.
alter function public.get_conformidade_operacional(uuid) security invoker;
alter function public.get_faturamento_dashboard(date,date,uuid,text) security invoker;
alter function public.get_faturamento_inadimplencia(integer,text) security invoker;
alter function public.get_faturamento_nfse(text,text) security invoker;
alter function public.get_faturamento_recorrencias() security invoker;
alter function public.get_financeiro_dashboard(integer) security invoker;
alter function public.get_planejamento_clientes() security invoker;
alter function public.get_planejamento_historico() security invoker;
alter function public.get_relatorio_conformidade_json(uuid) security invoker;
alter function public.get_relatorio_faturamento_json(uuid,date,date) security invoker;
alter function public.get_relatorio_pessoal_json(uuid) security invoker;
alter function public.get_contas_bancarias_resumo() security invoker;
alter function public.listar_agenda_padroes_ocorrencias(
  integer,integer,integer
) security invoker;
alter function public.listar_configuracoes_modulos_sistema() security invoker;
alter function public.listar_reforma_tributaria_historico(uuid) security invoker;
alter function public.listar_reforma_tributaria_painel() security invoker;

alter function public.baixar_manual_cobranca_custom(
  uuid,date,text,numeric,numeric,numeric,text,boolean,uuid
) security invoker;
alter function public.cancelar_cobranca_financeira(uuid) security invoker;
alter function public.confirmar_recebimento_financeiro(uuid) security invoker;
alter function public.pagar_despesa_financeira(
  uuid,uuid,date,numeric,numeric,numeric,text
) security invoker;
alter function public.salvar_conta_bancaria(jsonb) security invoker;
alter function public.salvar_contrato_financeiro(jsonb) security invoker;
alter function public.salvar_lancamento_financeiro(jsonb) security invoker;
alter function public.salvar_planejamento_tributario(uuid,text) security invoker;
alter function public.salvar_agenda_padroes_eventos(jsonb) security invoker;
alter function public.upsert_configuracoes_empresa(jsonb) security invoker;
alter function public.upsert_configuracoes_marca_dagua(jsonb) security invoker;
alter function public.upsert_configuracoes_perfil_acesso(
  uuid,text,text,text[]
) security invoker;
alter function public.desativar_configuracoes_perfil_acesso(uuid)
  security invoker;
alter function public.set_contador_responsavel(uuid) security invoker;

revoke execute on function public.ensure_atividades_instancias(
  character varying
) from authenticated;
revoke execute on function public.agenda_seed_padroes_eventos(uuid)
  from authenticated;
revoke execute on function public.seed_pastas_documentos_padrao_empresa(uuid)
  from authenticated;
revoke execute on function public.seed_perfis_acesso_empresa(uuid)
  from authenticated;

alter function public.set_default_clientes_pastas_documentos()
  set search_path=public,pg_temp;
alter function public.block_delete_parametrizacao_pastas_documentos_sistema()
  set search_path=public,pg_temp;
alter function public.block_delete_parametrizacao_tipos_documentos_sistema()
  set search_path=public,pg_temp;
alter function public.set_default_clientes_modelos_ativos()
  set search_path=public,pg_temp;
alter function public.expand_pastas_documentos_paths(text[])
  set search_path=public,pg_temp;
alter function public.set_atividades_modelos_atualizado_em()
  set search_path=public,pg_temp;
alter function public.set_atividades_instancias_atualizado_em()
  set search_path=public,pg_temp;
