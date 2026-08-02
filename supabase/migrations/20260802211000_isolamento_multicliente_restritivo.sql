-- Políticas restritivas: uma conta vinculada a cliente só acessa linhas do cliente mapeado.

do $$
declare t text;
begin
  foreach t in array array[
    'atividades_fechamentos','atividades_instancias',
    'atividades_rotinas','atividades_tarefas'
  ]
  loop
    execute format('drop policy if exists isolamento_cliente_select on public.%I',t);
    execute format(
      'create policy isolamento_cliente_select on public.%I as restrictive for select to authenticated using (public.current_user_can_access_client_row(empresa_id,cliente_id))',
      t
    );
  end loop;
end $$;

do $$
declare t text; perm text;
begin
  for t,perm in
    select * from (values
      ('agenda_eventos','agenda:view-own'),
      ('configuracoes_protocolos_empresas','protocolos:view-own'),
      ('conformidade_obrigacoes','conformidade:view-own'),
      ('documentos','documentos:view-own'),
      ('documentos_categorias','documentos:view-own'),
      ('planejamento_tributario_historico','planejamento:view-own'),
      ('protocolos_entregas','protocolos:view-own'),
      ('reforma_tributaria_adequacoes','reforma-tributaria:view-own'),
      ('reforma_tributaria_decisoes','reforma-tributaria:view-own'),
      ('reforma_tributaria_simulacoes','reforma-tributaria:view-own'),
      ('reforma_tributaria_validacoes_xml','reforma-tributaria:view-own')
    ) v(t,perm)
  loop
    execute format('drop policy if exists isolamento_cliente_select on public.%I',t);
    execute format(
      'create policy isolamento_cliente_select on public.%I as restrictive for select to authenticated using (
        not public.current_user_is_client_scoped(empresa_id)
        or (
          public.current_user_can_access_client_row(empresa_id,cliente_id)
          and public.current_user_has_permission(empresa_id,%L)
        )
      )',t,perm
    );

    execute format('drop policy if exists isolamento_cliente_insert on public.%I',t);
    execute format(
      'create policy isolamento_cliente_insert on public.%I as restrictive for insert to authenticated with check (
        not public.current_user_is_client_scoped(empresa_id)
      )',t
    );

    execute format('drop policy if exists isolamento_cliente_update on public.%I',t);
    execute format(
      'create policy isolamento_cliente_update on public.%I as restrictive for update to authenticated using (
        not public.current_user_is_client_scoped(empresa_id)
      ) with check (
        not public.current_user_is_client_scoped(empresa_id)
      )',t
    );

    execute format('drop policy if exists isolamento_cliente_delete on public.%I',t);
    execute format(
      'create policy isolamento_cliente_delete on public.%I as restrictive for delete to authenticated using (
        not public.current_user_is_client_scoped(empresa_id)
      )',t
    );
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'configuracoes_integracao_fiscal',
    'configuracoes_integracao_fiscal_logs'
  ]
  loop
    execute format('drop policy if exists isolamento_cliente_select on public.%I',t);
    execute format(
      'create policy isolamento_cliente_select on public.%I as restrictive for select to authenticated using (
        not public.current_user_is_client_scoped(empresa_id)
      )',t
    );
    execute format('drop policy if exists isolamento_cliente_insert on public.%I',t);
    execute format(
      'create policy isolamento_cliente_insert on public.%I as restrictive for insert to authenticated with check (
        not public.current_user_is_client_scoped(empresa_id)
      )',t
    );
    execute format('drop policy if exists isolamento_cliente_update on public.%I',t);
    execute format(
      'create policy isolamento_cliente_update on public.%I as restrictive for update to authenticated using (
        not public.current_user_is_client_scoped(empresa_id)
      ) with check (
        not public.current_user_is_client_scoped(empresa_id)
      )',t
    );
    execute format('drop policy if exists isolamento_cliente_delete on public.%I',t);
    execute format(
      'create policy isolamento_cliente_delete on public.%I as restrictive for delete to authenticated using (
        not public.current_user_is_client_scoped(empresa_id)
      )',t
    );
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'financeiro_cobrancas','financeiro_configuracoes','financeiro_lancamentos'
  ]
  loop
    execute format('drop policy if exists isolamento_cliente_select on public.%I',t);
    execute format(
      'create policy isolamento_cliente_select on public.%I as restrictive for select to authenticated using (
        not public.current_user_is_client_scoped(empresa_id)
        or (
          public.current_user_can_access_client_row(empresa_id,cliente_empresa_id)
          and public.current_user_has_permission(empresa_id,''faturamento:view-own'')
        )
      )',t
    );
    execute format('drop policy if exists isolamento_cliente_insert on public.%I',t);
    execute format(
      'create policy isolamento_cliente_insert on public.%I as restrictive for insert to authenticated with check (
        not public.current_user_is_client_scoped(empresa_id)
      )',t
    );
    execute format('drop policy if exists isolamento_cliente_update on public.%I',t);
    execute format(
      'create policy isolamento_cliente_update on public.%I as restrictive for update to authenticated using (
        not public.current_user_is_client_scoped(empresa_id)
      ) with check (
        not public.current_user_is_client_scoped(empresa_id)
      )',t
    );
    execute format('drop policy if exists isolamento_cliente_delete on public.%I',t);
    execute format(
      'create policy isolamento_cliente_delete on public.%I as restrictive for delete to authenticated using (
        not public.current_user_is_client_scoped(empresa_id)
      )',t
    );
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and exists (
        select 1 from pg_attribute a
        where a.attrelid=c.oid and a.attname='empresa_id'
          and a.attnum>0 and not a.attisdropped
      )
      and not exists (
        select 1 from pg_attribute a
        where a.attrelid=c.oid and a.attname in ('cliente_id','cliente_empresa_id')
          and a.attnum>0 and not a.attisdropped
      )
      and c.relname not in (
        'clientes','perfis','configuracoes_usuarios','configuracoes_perfis_acesso',
        'atividades_modelos','mensagens_inspiradoras',
        'mensagens_inspiradoras_empresas_dia',
        'preferencias_sidebar_menu','preferencias_usuario_modulos'
      )
  loop
    execute format('drop policy if exists isolamento_cliente_interno on public.%I',r.relname);
    execute format(
      'create policy isolamento_cliente_interno on public.%I as restrictive for all to authenticated using (
        not public.current_user_is_client_scoped(empresa_id)
      ) with check (
        not public.current_user_is_client_scoped(empresa_id)
      )',r.relname
    );
  end loop;
end $$;

drop policy if exists isolamento_cliente_perfil_acesso
on public.configuracoes_perfis_acesso;
create policy isolamento_cliente_perfil_acesso
on public.configuracoes_perfis_acesso
as restrictive for select to authenticated
using (
  not public.current_user_is_client_scoped(empresa_id)
  or exists (
    select 1 from public.configuracoes_usuarios u
    where u.empresa_id=configuracoes_perfis_acesso.empresa_id
      and u.auth_user_id=auth.uid()
      and u.status='Ativo'
      and lower(u.perfil)=lower(configuracoes_perfis_acesso.nome)
  )
);

drop policy if exists isolamento_cliente_modelos_atividade
on public.atividades_modelos;
create policy isolamento_cliente_modelos_atividade
on public.atividades_modelos
as restrictive for select to authenticated
using (
  not public.current_user_is_client_scoped(empresa_id)
  or exists (
    select 1 from public.atividades_rotinas r
    where r.empresa_id=atividades_modelos.empresa_id
      and r.modelo_id=atividades_modelos.id
      and r.cliente_id is not null
      and public.current_user_has_client_access(r.empresa_id,r.cliente_id)
  )
  or exists (
    select 1 from public.atividades_instancias i
    where i.empresa_id=atividades_modelos.empresa_id
      and i.modelo_id=atividades_modelos.id
      and i.cliente_id is not null
      and public.current_user_has_client_access(i.empresa_id,i.cliente_id)
  )
);
