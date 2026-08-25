-- Recuperada do histórico remoto do Supabase.
-- O ajuste de permissões de uma empresa específica foi omitido deste repositório público.
create table if not exists public.cliente_usuario_acessos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'Ativo' check (status in ('Ativo','Inativo')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, cliente_id, auth_user_id)
);

create index if not exists idx_cliente_usuario_acessos_auth_ativo
  on public.cliente_usuario_acessos(auth_user_id, empresa_id, cliente_id)
  where status = 'Ativo';

alter table public.cliente_usuario_acessos enable row level security;

create or replace function public.current_user_has_client_access(
  p_empresa_id uuid,
  p_cliente_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.cliente_usuario_acessos a
      where a.auth_user_id = auth.uid()
        and a.empresa_id = p_empresa_id
        and a.cliente_id = p_cliente_id
        and a.status = 'Ativo'
    );
$$;

revoke all on function public.current_user_has_client_access(uuid,uuid) from public, anon;
grant execute on function public.current_user_has_client_access(uuid,uuid) to authenticated, service_role;

drop policy if exists cliente_usuario_acessos_select_own on public.cliente_usuario_acessos;
create policy cliente_usuario_acessos_select_own
on public.cliente_usuario_acessos for select
to authenticated
using (
  auth_user_id = auth.uid()
  or public.current_user_has_permission(empresa_id, 'usuarios:manage')
);

drop policy if exists cliente_usuario_acessos_manage on public.cliente_usuario_acessos;
create policy cliente_usuario_acessos_manage
on public.cliente_usuario_acessos for all
to authenticated
using (public.current_user_has_permission(empresa_id, 'usuarios:manage'))
with check (
  public.current_user_has_permission(empresa_id, 'usuarios:manage')
  and exists (
    select 1 from public.clientes c
    where c.id = cliente_id and c.empresa_id = empresa_id
  )
);

drop policy if exists clientes_select_own on public.clientes;
create policy clientes_select_own
on public.clientes for select
to authenticated
using (
  public.current_user_has_permission(empresa_id, 'clientes:view')
  or public.current_user_has_client_access(empresa_id, id)
);

drop policy if exists clientes_select_permission on public.clientes;

drop policy if exists atividades_rotinas_select_scope on public.atividades_rotinas;
create policy atividades_rotinas_select_scope
on public.atividades_rotinas for select
to authenticated
using (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id, 'atividades:view')
    and responsavel_user_id = auth.uid()
  )
  or (
    cliente_id is not null
    and public.current_user_has_permission(empresa_id, 'atividades:view-own')
    and public.current_user_has_client_access(empresa_id, cliente_id)
  )
);

drop policy if exists atividades_tarefas_select_scope on public.atividades_tarefas;
create policy atividades_tarefas_select_scope
on public.atividades_tarefas for select
to authenticated
using (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id, 'atividades:view')
    and responsavel_user_id = auth.uid()
  )
  or (
    cliente_id is not null
    and public.current_user_has_permission(empresa_id, 'atividades:view-own')
    and public.current_user_has_client_access(empresa_id, cliente_id)
  )
);

drop policy if exists atividades_tarefas_update_scope on public.atividades_tarefas;
create policy atividades_tarefas_update_scope
on public.atividades_tarefas for update
to authenticated
using (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id, 'atividades:update-own')
    and (
      responsavel_user_id = auth.uid()
      or (
        cliente_id is not null
        and public.current_user_has_client_access(empresa_id, cliente_id)
      )
    )
  )
)
with check (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id, 'atividades:update-own')
    and (
      responsavel_user_id = auth.uid()
      or (
        cliente_id is not null
        and public.current_user_has_client_access(empresa_id, cliente_id)
      )
    )
  )
);

drop policy if exists atividades_instancias_empresa_policy on public.atividades_instancias;

create policy atividades_instancias_select_scope
on public.atividades_instancias for select
to authenticated
using (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  or (
    cliente_id is not null
    and public.current_user_has_permission(empresa_id, 'atividades:view-own')
    and public.current_user_has_client_access(empresa_id, cliente_id)
  )
  or (
    public.current_user_has_permission(empresa_id, 'atividades:view')
    and exists (
      select 1
      from public.atividades_tarefas t
      where t.empresa_id = atividades_instancias.empresa_id
        and t.cliente_id is not distinct from atividades_instancias.cliente_id
        and t.modelo_id is not distinct from atividades_instancias.modelo_id
        and t.competencia = atividades_instancias.competencia
        and t.responsavel_user_id = auth.uid()
        and t.ativo = true
    )
  )
);

create policy atividades_instancias_insert_manager
on public.atividades_instancias for insert
to authenticated
with check (public.current_user_has_permission(empresa_id, 'atividades:manage'));

create policy atividades_instancias_update_scope
on public.atividades_instancias for update
to authenticated
using (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id, 'atividades:update-own')
    and (
      (
        cliente_id is not null
        and public.current_user_has_client_access(empresa_id, cliente_id)
      )
      or exists (
        select 1
        from public.atividades_tarefas t
        where t.empresa_id = atividades_instancias.empresa_id
          and t.cliente_id is not distinct from atividades_instancias.cliente_id
          and t.modelo_id is not distinct from atividades_instancias.modelo_id
          and t.competencia = atividades_instancias.competencia
          and t.responsavel_user_id = auth.uid()
          and t.ativo = true
      )
    )
  )
)
with check (
  public.current_user_has_permission(empresa_id, 'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id, 'atividades:update-own')
    and (
      (
        cliente_id is not null
        and public.current_user_has_client_access(empresa_id, cliente_id)
      )
      or exists (
        select 1
        from public.atividades_tarefas t
        where t.empresa_id = atividades_instancias.empresa_id
          and t.cliente_id is not distinct from atividades_instancias.cliente_id
          and t.modelo_id is not distinct from atividades_instancias.modelo_id
          and t.competencia = atividades_instancias.competencia
          and t.responsavel_user_id = auth.uid()
          and t.ativo = true
      )
    )
  )
);

create policy atividades_instancias_delete_manager
on public.atividades_instancias for delete
to authenticated
using (public.current_user_has_permission(empresa_id, 'atividades:manage'));

create or replace function public.atualizar_atividade_checklist(
  p_instancia_id uuid,
  p_etapa text,
  p_concluida boolean,
  p_data_hora timestamptz default now()
)
returns public.atividades_instancias
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_instancia public.atividades_instancias%rowtype;
  v_usuario text;
  v_checklists jsonb;
  v_status text;
  v_autorizado boolean;
begin
  if auth.uid() is null or nullif(trim(p_etapa), '') is null then
    raise exception 'Solicitação inválida';
  end if;

  select i.*
    into v_instancia
  from public.atividades_instancias i
  where i.id = p_instancia_id
    and i.ativo = true
  for update;

  if not found then
    raise exception 'Atividade não encontrada';
  end if;

  if not (coalesce(v_instancia.checklists, '{}'::jsonb) ? p_etapa) then
    raise exception 'Etapa inválida';
  end if;

  v_autorizado :=
    public.current_user_has_permission(v_instancia.empresa_id, 'atividades:manage')
    or (
      public.current_user_has_permission(v_instancia.empresa_id, 'atividades:update-own')
      and (
        (
          v_instancia.cliente_id is not null
          and public.current_user_has_client_access(v_instancia.empresa_id, v_instancia.cliente_id)
        )
        or exists (
          select 1
          from public.atividades_tarefas t
          where t.empresa_id = v_instancia.empresa_id
            and t.cliente_id is not distinct from v_instancia.cliente_id
            and t.modelo_id is not distinct from v_instancia.modelo_id
            and t.competencia = v_instancia.competencia
            and t.responsavel_user_id = auth.uid()
            and t.ativo = true
        )
      )
    );

  if not v_autorizado then
    raise exception 'Atividade não encontrada';
  end if;

  select coalesce(
    (
      select nullif(trim(u.nome), '')
      from public.configuracoes_usuarios u
      where u.empresa_id = v_instancia.empresa_id
        and u.auth_user_id = auth.uid()
        and u.status = 'Ativo'
      limit 1
    ),
    (
      select nullif(trim(p.nome), '')
      from public.perfis p
      where p.empresa_id = v_instancia.empresa_id
        and p.user_id = auth.uid()
        and p.ativo = true
      limit 1
    ),
    auth.uid()::text
  ) into v_usuario;

  v_checklists := jsonb_set(
    coalesce(v_instancia.checklists, '{}'::jsonb),
    array[p_etapa],
    to_jsonb(coalesce(p_concluida, false)),
    false
  );

  select case
    when count(*) > 0 and bool_and(value::boolean) then 'Concluída'
    when bool_or(value::boolean) then 'Em andamento'
    else 'Pendente'
  end
  into v_status
  from jsonb_each(v_checklists);

  update public.atividades_instancias
  set checklists = v_checklists,
      checklist_dates = jsonb_set(
        coalesce(checklist_dates, '{}'::jsonb),
        array[p_etapa],
        case when p_concluida then to_jsonb(now()) else 'null'::jsonb end,
        false
      ),
      checklist_users = jsonb_set(
        coalesce(checklist_users, '{}'::jsonb),
        array[p_etapa],
        case when p_concluida then to_jsonb(v_usuario) else 'null'::jsonb end,
        false
      ),
      status = v_status,
      atualizado_em = now()
  where id = p_instancia_id
  returning * into v_instancia;

  return v_instancia;
end;
$$;

revoke all on function public.atualizar_atividade_checklist(uuid,text,boolean,timestamptz) from public, anon;
grant execute on function public.atualizar_atividade_checklist(uuid,text,boolean,timestamptz) to authenticated, service_role;
