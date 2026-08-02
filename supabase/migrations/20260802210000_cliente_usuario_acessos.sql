-- Isolamento de usuários externos por cliente.
-- Esta migration não cria usuários e não contém credenciais.

create table if not exists public.cliente_usuario_acessos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'Ativo' check (status in ('Ativo','Inativo')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id,cliente_id,auth_user_id)
);

create index if not exists idx_cliente_usuario_acessos_auth_ativo
  on public.cliente_usuario_acessos(auth_user_id,empresa_id,cliente_id)
  where status='Ativo';

alter table public.cliente_usuario_acessos enable row level security;

create or replace function public.current_user_has_client_access(
  p_empresa_id uuid,p_cliente_id uuid
) returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.cliente_usuario_acessos a
    where a.auth_user_id=auth.uid()
      and a.empresa_id=p_empresa_id
      and a.cliente_id=p_cliente_id
      and a.status='Ativo'
  );
$$;

create or replace function public.current_user_is_client_scoped(p_empresa_id uuid)
returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.cliente_usuario_acessos a
    where a.auth_user_id=auth.uid()
      and a.empresa_id=p_empresa_id
      and a.status='Ativo'
  );
$$;

create or replace function public.current_user_can_access_client_row(
  p_empresa_id uuid,p_cliente_id uuid
) returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $$
  select auth.uid() is not null and (
    (p_empresa_id is null and p_cliente_id is null)
    or (
      p_empresa_id is not null
      and public.is_empresa_member(p_empresa_id)
      and (
        not public.current_user_is_client_scoped(p_empresa_id)
        or (
          p_cliente_id is not null
          and public.current_user_has_client_access(p_empresa_id,p_cliente_id)
        )
      )
    )
  );
$$;

create or replace function public.current_user_can_access_client_row(
  p_empresa_id uuid,p_cliente_id text
) returns boolean
language sql stable security definer
set search_path=public,pg_temp
as $$
  select auth.uid() is not null and (
    (p_empresa_id is null and nullif(trim(p_cliente_id),'') is null)
    or (
      p_empresa_id is not null
      and public.is_empresa_member(p_empresa_id)
      and (
        not public.current_user_is_client_scoped(p_empresa_id)
        or exists (
          select 1 from public.cliente_usuario_acessos a
          where a.auth_user_id=auth.uid()
            and a.empresa_id=p_empresa_id
            and a.status='Ativo'
            and a.cliente_id::text=nullif(trim(p_cliente_id),'')
        )
      )
    )
  );
$$;

revoke all on function public.current_user_has_client_access(uuid,uuid) from public,anon;
revoke all on function public.current_user_is_client_scoped(uuid) from public,anon;
revoke all on function public.current_user_can_access_client_row(uuid,uuid) from public,anon;
revoke all on function public.current_user_can_access_client_row(uuid,text) from public,anon;
grant execute on function public.current_user_has_client_access(uuid,uuid) to authenticated,service_role;
grant execute on function public.current_user_is_client_scoped(uuid) to authenticated,service_role;
grant execute on function public.current_user_can_access_client_row(uuid,uuid) to authenticated,service_role;
grant execute on function public.current_user_can_access_client_row(uuid,text) to authenticated,service_role;

drop policy if exists cliente_usuario_acessos_select_own on public.cliente_usuario_acessos;
create policy cliente_usuario_acessos_select_own
on public.cliente_usuario_acessos for select to authenticated
using (
  auth_user_id=auth.uid()
  or public.current_user_has_permission(empresa_id,'usuarios:manage')
);

drop policy if exists cliente_usuario_acessos_insert_manager on public.cliente_usuario_acessos;
create policy cliente_usuario_acessos_insert_manager
on public.cliente_usuario_acessos for insert to authenticated
with check (
  public.current_user_has_permission(empresa_id,'usuarios:manage')
  and exists (
    select 1 from public.clientes cli
    where cli.id=cliente_usuario_acessos.cliente_id
      and cli.empresa_id=cliente_usuario_acessos.empresa_id
  )
);

drop policy if exists cliente_usuario_acessos_update_manager on public.cliente_usuario_acessos;
create policy cliente_usuario_acessos_update_manager
on public.cliente_usuario_acessos for update to authenticated
using (public.current_user_has_permission(empresa_id,'usuarios:manage'))
with check (
  public.current_user_has_permission(empresa_id,'usuarios:manage')
  and exists (
    select 1 from public.clientes cli
    where cli.id=cliente_usuario_acessos.cliente_id
      and cli.empresa_id=cliente_usuario_acessos.empresa_id
  )
);

drop policy if exists cliente_usuario_acessos_delete_manager on public.cliente_usuario_acessos;
create policy cliente_usuario_acessos_delete_manager
on public.cliente_usuario_acessos for delete to authenticated
using (public.current_user_has_permission(empresa_id,'usuarios:manage'));

drop policy if exists clientes_select_permission on public.clientes;
drop policy if exists clientes_select_own on public.clientes;
create policy clientes_select_own
on public.clientes for select to authenticated
using (
  public.current_user_has_permission(empresa_id,'clientes:view')
  or public.current_user_has_client_access(empresa_id,id)
);

drop policy if exists atividades_rotinas_select_scope on public.atividades_rotinas;
create policy atividades_rotinas_select_scope
on public.atividades_rotinas for select to authenticated
using (
  public.current_user_has_permission(empresa_id,'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id,'atividades:view')
    and responsavel_user_id=auth.uid()
  )
  or (
    cliente_id is not null
    and public.current_user_has_permission(empresa_id,'atividades:view-own')
    and public.current_user_has_client_access(empresa_id,cliente_id)
  )
);

drop policy if exists atividades_tarefas_select_scope on public.atividades_tarefas;
create policy atividades_tarefas_select_scope
on public.atividades_tarefas for select to authenticated
using (
  public.current_user_has_permission(empresa_id,'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id,'atividades:view')
    and responsavel_user_id=auth.uid()
  )
  or (
    cliente_id is not null
    and public.current_user_has_permission(empresa_id,'atividades:view-own')
    and public.current_user_has_client_access(empresa_id,cliente_id)
  )
);

drop policy if exists atividades_tarefas_update_scope on public.atividades_tarefas;
create policy atividades_tarefas_update_scope
on public.atividades_tarefas for update to authenticated
using (
  public.current_user_has_permission(empresa_id,'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id,'atividades:update-own')
    and (
      responsavel_user_id=auth.uid()
      or (
        cliente_id is not null
        and public.current_user_has_client_access(empresa_id,cliente_id)
      )
    )
  )
)
with check (
  public.current_user_has_permission(empresa_id,'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id,'atividades:update-own')
    and (
      responsavel_user_id=auth.uid()
      or (
        cliente_id is not null
        and public.current_user_has_client_access(empresa_id,cliente_id)
      )
    )
  )
);

drop policy if exists atividades_instancias_empresa_policy on public.atividades_instancias;
drop policy if exists atividades_instancias_select_scope on public.atividades_instancias;
create policy atividades_instancias_select_scope
on public.atividades_instancias for select to authenticated
using (
  public.current_user_has_permission(empresa_id,'atividades:manage')
  or (
    cliente_id is not null
    and public.current_user_has_permission(empresa_id,'atividades:view-own')
    and public.current_user_has_client_access(empresa_id,cliente_id)
  )
  or (
    public.current_user_has_permission(empresa_id,'atividades:view')
    and exists (
      select 1 from public.atividades_tarefas t
      where t.empresa_id=atividades_instancias.empresa_id
        and t.cliente_id is not distinct from atividades_instancias.cliente_id
        and t.modelo_id is not distinct from atividades_instancias.modelo_id
        and t.competencia=atividades_instancias.competencia
        and t.responsavel_user_id=auth.uid()
        and t.ativo=true
    )
  )
);

drop policy if exists atividades_instancias_insert_manager on public.atividades_instancias;
create policy atividades_instancias_insert_manager
on public.atividades_instancias for insert to authenticated
with check (public.current_user_has_permission(empresa_id,'atividades:manage'));

drop policy if exists atividades_instancias_update_scope on public.atividades_instancias;
create policy atividades_instancias_update_scope
on public.atividades_instancias for update to authenticated
using (
  public.current_user_has_permission(empresa_id,'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id,'atividades:update-own')
    and (
      (
        cliente_id is not null
        and public.current_user_has_client_access(empresa_id,cliente_id)
      )
      or exists (
        select 1 from public.atividades_tarefas t
        where t.empresa_id=atividades_instancias.empresa_id
          and t.cliente_id is not distinct from atividades_instancias.cliente_id
          and t.modelo_id is not distinct from atividades_instancias.modelo_id
          and t.competencia=atividades_instancias.competencia
          and t.responsavel_user_id=auth.uid()
          and t.ativo=true
      )
    )
  )
)
with check (
  public.current_user_has_permission(empresa_id,'atividades:manage')
  or (
    public.current_user_has_permission(empresa_id,'atividades:update-own')
    and (
      (
        cliente_id is not null
        and public.current_user_has_client_access(empresa_id,cliente_id)
      )
      or exists (
        select 1 from public.atividades_tarefas t
        where t.empresa_id=atividades_instancias.empresa_id
          and t.cliente_id is not distinct from atividades_instancias.cliente_id
          and t.modelo_id is not distinct from atividades_instancias.modelo_id
          and t.competencia=atividades_instancias.competencia
          and t.responsavel_user_id=auth.uid()
          and t.ativo=true
      )
    )
  )
);

drop policy if exists atividades_instancias_delete_manager on public.atividades_instancias;
create policy atividades_instancias_delete_manager
on public.atividades_instancias for delete to authenticated
using (public.current_user_has_permission(empresa_id,'atividades:manage'));

update public.configuracoes_perfis_acesso
set permissoes=(
  select array_agg(distinct x order by x)
  from unnest(permissoes || array[
    'inicio:view','atividades:view','atividades:update-own'
  ]) x
),updated_at=now()
where nome='Cliente Externo';
