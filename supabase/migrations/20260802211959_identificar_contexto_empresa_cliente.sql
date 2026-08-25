create or replace function public.current_access_context()
returns jsonb
language plpgsql
stable
security definer
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
    and e.status='Ativa'
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
      )
      order by c.nome
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
      when v_escopo_cliente then coalesce(v_cliente_principal->>'nome',v_empresa_nome)
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
grant execute on function public.current_access_context() to authenticated,service_role;
