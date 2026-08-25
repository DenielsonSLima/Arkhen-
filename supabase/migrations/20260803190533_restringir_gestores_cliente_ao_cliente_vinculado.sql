drop policy if exists clientes_isolamento_scoped_select on public.clientes;
create policy clientes_isolamento_scoped_select
on public.clientes
as restrictive
for select
to authenticated
using (
  not public.current_user_is_client_scoped(empresa_id)
  or public.current_user_has_client_access(empresa_id,id)
);

drop policy if exists clientes_isolamento_scoped_update on public.clientes;
create policy clientes_isolamento_scoped_update
on public.clientes
as restrictive
for update
to authenticated
using (
  not public.current_user_is_client_scoped(empresa_id)
  or public.current_user_has_client_access(empresa_id,id)
)
with check (
  not public.current_user_is_client_scoped(empresa_id)
  or public.current_user_has_client_access(empresa_id,id)
);

drop policy if exists clientes_isolamento_scoped_delete on public.clientes;
create policy clientes_isolamento_scoped_delete
on public.clientes
as restrictive
for delete
to authenticated
using (
  not public.current_user_is_client_scoped(empresa_id)
  or public.current_user_has_client_access(empresa_id,id)
);

drop policy if exists clientes_isolamento_scoped_insert on public.clientes;
create policy clientes_isolamento_scoped_insert
on public.clientes
as restrictive
for insert
to authenticated
with check (
  not public.current_user_is_client_scoped(empresa_id)
);
