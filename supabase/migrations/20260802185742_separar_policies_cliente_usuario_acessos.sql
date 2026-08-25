drop policy if exists cliente_usuario_acessos_manage on public.cliente_usuario_acessos;

create policy cliente_usuario_acessos_insert_manager
on public.cliente_usuario_acessos for insert
to authenticated
with check (
  public.current_user_has_permission(empresa_id, 'usuarios:manage')
  and exists (
    select 1 from public.clientes c
    where c.id = cliente_id and c.empresa_id = empresa_id
  )
);

create policy cliente_usuario_acessos_update_manager
on public.cliente_usuario_acessos for update
to authenticated
using (public.current_user_has_permission(empresa_id, 'usuarios:manage'))
with check (
  public.current_user_has_permission(empresa_id, 'usuarios:manage')
  and exists (
    select 1 from public.clientes c
    where c.id = cliente_id and c.empresa_id = empresa_id
  )
);

create policy cliente_usuario_acessos_delete_manager
on public.cliente_usuario_acessos for delete
to authenticated
using (public.current_user_has_permission(empresa_id, 'usuarios:manage'));
