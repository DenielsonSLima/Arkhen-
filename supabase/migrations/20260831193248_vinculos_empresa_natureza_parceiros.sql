alter table public.clientes
  add column if not exists tipo_parceiro_id uuid,
  add column if not exists tipo_parceiro_catalogo_tipo varchar(64) not null default 'tipos_parceiros',
  add column if not exists tipo_empresa_id uuid,
  add column if not exists tipo_empresa_catalogo_tipo varchar(64) not null default 'tipos_empresa',
  add column if not exists natureza_juridica_id uuid,
  add column if not exists natureza_juridica_catalogo_tipo varchar(64) not null default 'naturezas_juridicas';

-- O PostgreSQL exige uma chave única com as mesmas colunas referenciadas
-- pelos vínculos compostos abaixo, inclusive em um replay integral do schema.
create unique index if not exists parametrizacao_catalogos_id_empresa_tipo_unq
  on public.parametrizacao_catalogos (id, empresa_id, tipo);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clientes'::regclass
      and conname = 'clientes_tipo_parceiro_catalogo_tipo_check'
  ) then
    alter table public.clientes
      add constraint clientes_tipo_parceiro_catalogo_tipo_check
      check (tipo_parceiro_catalogo_tipo = 'tipos_parceiros');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clientes'::regclass
      and conname = 'clientes_tipo_parceiro_tenant_fk'
  ) then
    alter table public.clientes
      add constraint clientes_tipo_parceiro_tenant_fk
      foreign key (tipo_parceiro_id, empresa_id, tipo_parceiro_catalogo_tipo)
      references public.parametrizacao_catalogos (id, empresa_id, tipo)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clientes'::regclass
      and conname = 'clientes_tipo_empresa_catalogo_tipo_check'
  ) then
    alter table public.clientes
      add constraint clientes_tipo_empresa_catalogo_tipo_check
      check (tipo_empresa_catalogo_tipo = 'tipos_empresa');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clientes'::regclass
      and conname = 'clientes_natureza_juridica_catalogo_tipo_check'
  ) then
    alter table public.clientes
      add constraint clientes_natureza_juridica_catalogo_tipo_check
      check (natureza_juridica_catalogo_tipo = 'naturezas_juridicas');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clientes'::regclass
      and conname = 'clientes_tipo_empresa_tenant_fk'
  ) then
    alter table public.clientes
      add constraint clientes_tipo_empresa_tenant_fk
      foreign key (tipo_empresa_id, empresa_id, tipo_empresa_catalogo_tipo)
      references public.parametrizacao_catalogos (id, empresa_id, tipo)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.clientes'::regclass
      and conname = 'clientes_natureza_juridica_tenant_fk'
  ) then
    alter table public.clientes
      add constraint clientes_natureza_juridica_tenant_fk
      foreign key (natureza_juridica_id, empresa_id, natureza_juridica_catalogo_tipo)
      references public.parametrizacao_catalogos (id, empresa_id, tipo)
      on delete restrict;
  end if;
end;
$$;

create index if not exists clientes_tipo_parceiro_tenant_fk_idx
  on public.clientes (tipo_parceiro_id, empresa_id, tipo_parceiro_catalogo_tipo)
  where tipo_parceiro_id is not null;

create index if not exists clientes_tipo_empresa_tenant_fk_idx
  on public.clientes (tipo_empresa_id, empresa_id, tipo_empresa_catalogo_tipo)
  where tipo_empresa_id is not null;

create index if not exists clientes_natureza_juridica_tenant_fk_idx
  on public.clientes (natureza_juridica_id, empresa_id, natureza_juridica_catalogo_tipo)
  where natureza_juridica_id is not null;

with cliente_contabil_por_empresa as (
  select distinct on (empresa_id)
    empresa_id,
    id
  from public.parametrizacao_catalogos
  where tipo = 'tipos_parceiros'
    and ativo
    and (
      codigo in ('cliente_contabil', 'tp-1')
      or nome = 'Cliente Contábil'
    )
  order by
    empresa_id,
    case
      when codigo = 'cliente_contabil' then 0
      when codigo = 'tp-1' then 1
      else 2
    end,
    ordem,
    id
)
update public.clientes as parceiro
set tipo_parceiro_id = catalogo.id
from cliente_contabil_por_empresa as catalogo
where parceiro.empresa_id = catalogo.empresa_id
  and parceiro.tipo_parceiro_id is null;

comment on column public.clientes.tipo_empresa_id is
  'Classificação de tipo de empresa no catálogo multiempresa tipos_empresa.';
comment on column public.clientes.natureza_juridica_id is
  'Classificação de natureza jurídica no catálogo multiempresa naturezas_juridicas.';
comment on column public.clientes.tipo_parceiro_id is
  'Classificação do relacionamento no catálogo multiempresa tipos_parceiros.';
