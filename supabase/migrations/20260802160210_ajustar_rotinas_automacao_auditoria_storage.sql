-- Vincula rotinas ao cliente por chave, materializa tarefas vencidas no banco,
-- registra o usuário autenticado no checklist e isola uploads por tenant.

alter table public.atividades_rotinas
  add column if not exists cliente_id uuid;

update public.atividades_rotinas r
set cliente_id = c.id,
    cliente_nome = c.nome
from public.clientes c
where r.cliente_id is null
  and r.empresa_id = c.empresa_id
  and lower(trim(r.cliente_nome)) = lower(trim(c.nome));

alter table public.atividades_rotinas
  drop constraint if exists atividades_rotinas_cliente_id_fkey;

alter table public.atividades_rotinas
  add constraint atividades_rotinas_cliente_id_fkey
  foreign key (cliente_id) references public.clientes(id) on delete set null;

create index if not exists idx_atividades_rotinas_empresa_cliente
  on public.atividades_rotinas (empresa_id, cliente_id)
  where ativa = true;

create unique index if not exists atividades_tarefas_rotina_vencimento_unq
  on public.atividades_tarefas (empresa_id, rotina_id, vencimento)
  where rotina_id is not null;

create or replace function public.validar_cliente_atividade_rotina()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cliente_nome text;
begin
  if new.cliente_id is null then
    if nullif(trim(new.cliente_nome), '') is null then
      new.cliente_nome := 'Escritório';
    end if;
    return new;
  end if;

  select c.nome
    into v_cliente_nome
  from public.clientes c
  where c.id = new.cliente_id
    and c.empresa_id = new.empresa_id;

  if v_cliente_nome is null then
    raise exception 'Cliente não pertence à empresa da rotina';
  end if;

  new.cliente_nome := v_cliente_nome;
  return new;
end;
$$;

revoke all on function public.validar_cliente_atividade_rotina() from public, anon, authenticated;

drop trigger if exists validar_cliente_atividade_rotina_trigger on public.atividades_rotinas;
create trigger validar_cliente_atividade_rotina_trigger
before insert or update of empresa_id, cliente_id, cliente_nome
on public.atividades_rotinas
for each row execute function public.validar_cliente_atividade_rotina();

create or replace function public.proxima_data_rotina(
  p_data date,
  p_frequencia text,
  p_intervalo_dias integer,
  p_incluir_finais_de_semana boolean
)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_proxima date;
begin
  v_proxima := case p_frequencia
    when 'Diária' then p_data + 1
    when 'Semanal' then p_data + 7
    when 'Quinzenal' then p_data + 15
    when 'Mensal' then (p_data + interval '1 month')::date
    else p_data + greatest(coalesce(p_intervalo_dias, 1), 1)
  end;

  if not coalesce(p_incluir_finais_de_semana, false) then
    while extract(isodow from v_proxima) in (6, 7) loop
      v_proxima := v_proxima + 1;
    end loop;
  end if;

  return v_proxima;
end;
$$;

revoke all on function public.proxima_data_rotina(date, text, integer, boolean)
  from public, anon, authenticated;

create or replace function public.materializar_atividades_rotinas(p_ate date default current_date)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
  v_rotina public.atividades_rotinas%rowtype;
  v_execucao date;
  v_checklist jsonb;
  v_criadas integer := 0;
  v_passos integer;
begin
  if v_empresa_id is null
     or not public.current_user_has_permission(v_empresa_id, 'atividades:manage') then
    raise exception 'Sem permissão para materializar rotinas';
  end if;

  if p_ate is null or p_ate > current_date + 31 then
    raise exception 'Data limite inválida';
  end if;

  for v_rotina in
    select r.*
    from public.atividades_rotinas r
    where r.empresa_id = v_empresa_id
      and r.ativa = true
      and r.proxima_execucao <= p_ate
    order by r.proxima_execucao, r.id
    for update skip locked
  loop
    v_execucao := v_rotina.proxima_execucao;
    v_passos := 0;

    select coalesce(
      jsonb_agg(
        case jsonb_typeof(item)
          when 'string' then jsonb_build_object('titulo', item #>> '{}', 'concluida', false)
          when 'object' then item || jsonb_build_object('concluida', false)
          else jsonb_build_object('titulo', item::text, 'concluida', false)
        end
      ),
      '[]'::jsonb
    ) into v_checklist
    from jsonb_array_elements(coalesce(v_rotina.checklist, '[]'::jsonb)) item;

    while v_execucao <= p_ate and v_passos < 120 loop
      insert into public.atividades_tarefas (
        empresa_id, rotina_id, modelo_id, cliente_id, titulo, categoria,
        frequencia, responsavel_nome, cliente_nome, competencia, vencimento,
        prioridade, status, origem, checklist, notas, ativo,
        responsavel_user_id, responsavel_config_usuario_id
      ) values (
        v_rotina.empresa_id, v_rotina.id, v_rotina.modelo_id, v_rotina.cliente_id,
        v_rotina.nome, v_rotina.categoria, v_rotina.frequencia,
        v_rotina.responsavel_nome, v_rotina.cliente_nome,
        to_char(v_execucao, 'MM/YYYY'), v_execucao, v_rotina.prioridade,
        'Pendente', 'Rotina', v_checklist, v_rotina.observacoes, true,
        v_rotina.responsavel_user_id, v_rotina.responsavel_config_usuario_id
      )
      on conflict (empresa_id, rotina_id, vencimento) where rotina_id is not null
      do nothing;

      if found then
        v_criadas := v_criadas + 1;
      end if;

      v_execucao := public.proxima_data_rotina(
        v_execucao,
        v_rotina.frequencia,
        v_rotina.intervalo_dias,
        v_rotina.incluir_finais_de_semana
      );
      v_passos := v_passos + 1;
    end loop;

    update public.atividades_rotinas
    set proxima_execucao = v_execucao,
        atualizado_em = now()
    where id = v_rotina.id;
  end loop;

  return v_criadas;
end;
$$;

revoke all on function public.materializar_atividades_rotinas(date) from public, anon;
grant execute on function public.materializar_atividades_rotinas(date) to authenticated;

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
begin
  if auth.uid() is null or nullif(trim(p_etapa), '') is null then
    raise exception 'Solicitação inválida';
  end if;

  select i.* into v_instancia
  from public.atividades_instancias i
  where i.id = p_instancia_id
    and i.ativo = true
  for update;

  if not found or not public.is_empresa_member(v_instancia.empresa_id) then
    raise exception 'Atividade não encontrada';
  end if;

  select coalesce(
    (select nullif(trim(u.nome), '')
       from public.configuracoes_usuarios u
      where u.empresa_id = v_instancia.empresa_id
        and u.auth_user_id = auth.uid()
        and u.status = 'Ativo'
      limit 1),
    (select nullif(trim(p.nome), '')
       from public.perfis p
      where p.empresa_id = v_instancia.empresa_id
        and p.user_id = auth.uid()
        and p.ativo = true
      limit 1),
    auth.uid()::text
  ) into v_usuario;

  v_checklists := jsonb_set(
    coalesce(v_instancia.checklists, '{}'::jsonb),
    array[p_etapa],
    to_jsonb(coalesce(p_concluida, false)),
    true
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
        coalesce(checklist_dates, '{}'::jsonb), array[p_etapa],
        case when p_concluida then to_jsonb(coalesce(p_data_hora, now())) else 'null'::jsonb end,
        true
      ),
      checklist_users = jsonb_set(
        coalesce(checklist_users, '{}'::jsonb), array[p_etapa],
        case when p_concluida then to_jsonb(v_usuario) else 'null'::jsonb end,
        true
      ),
      status = v_status,
      atualizado_em = now()
  where id = p_instancia_id
  returning * into v_instancia;

  return v_instancia;
end;
$$;

revoke all on function public.atualizar_atividade_checklist(uuid, text, boolean, timestamptz)
  from public, anon;
grant execute on function public.atualizar_atividade_checklist(uuid, text, boolean, timestamptz)
  to authenticated;

drop policy if exists app_assets_insert_policy on storage.objects;
create policy app_assets_insert_policy
on storage.objects for insert to authenticated
with check (
  bucket_id = 'app-assets'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = public.current_empresa_id()::text
);

drop policy if exists app_assets_update_policy on storage.objects;
create policy app_assets_update_policy
on storage.objects for update to authenticated
using (
  bucket_id = 'app-assets'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = public.current_empresa_id()::text
)
with check (
  bucket_id = 'app-assets'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = public.current_empresa_id()::text
);

drop policy if exists app_assets_delete_policy on storage.objects;
create policy app_assets_delete_policy
on storage.objects for delete to authenticated
using (
  bucket_id = 'app-assets'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = public.current_empresa_id()::text
);
