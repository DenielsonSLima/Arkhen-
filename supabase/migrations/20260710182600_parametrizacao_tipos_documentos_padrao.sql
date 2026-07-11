create table if not exists public.parametrizacao_tipos_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.current_empresa_id() references public.empresas(id) on delete cascade,
  codigo varchar(80) not null,
  nome varchar(120) not null,
  descricao text not null default '',
  sistema boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 100,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint parametrizacao_tipos_documentos_codigo_unique unique (empresa_id, codigo)
);

alter table public.parametrizacao_tipos_documentos enable row level security;

drop policy if exists parametrizacao_tipos_documentos_policy on public.parametrizacao_tipos_documentos;
create policy parametrizacao_tipos_documentos_policy on public.parametrizacao_tipos_documentos
  for all to authenticated
  using (public.is_empresa_member(empresa_id))
  with check (public.is_empresa_member(empresa_id));

drop trigger if exists set_tipos_documentos_updated_at on public.parametrizacao_tipos_documentos;
create trigger set_tipos_documentos_updated_at
  before update on public.parametrizacao_tipos_documentos
  for each row execute function public.set_updated_at();

create index if not exists idx_parametrizacao_tipos_documentos_empresa_nome
  on public.parametrizacao_tipos_documentos (empresa_id, nome);

insert into public.parametrizacao_tipos_documentos (empresa_id, codigo, nome, descricao, sistema, ativo, ordem)
select e.id, seed.codigo, seed.nome, seed.descricao, true, true, seed.ordem
from public.empresas e
cross join (values
  ('cnh', 'CNH', 'Carteira Nacional de Habilitacao para cadastros, validacoes e documentos pessoais.', 10),
  ('contrato', 'Contrato', 'Contratos sociais, contratos de prestacao de servicos e instrumentos contratuais vinculados ao cliente.', 20),
  ('financiamento', 'Financiamento', 'Documentos de financiamento, credito, parcelas, comprovantes e contratos bancarios relacionados.', 30),
  ('procuracao', 'Procuração', 'Procurações eletronicas, fisicas e autorizacoes de representacao do cliente.', 40)
) as seed(codigo, nome, descricao, ordem)
on conflict (empresa_id, codigo) do update
  set nome = excluded.nome,
      descricao = excluded.descricao,
      sistema = true,
      ordem = excluded.ordem,
      atualizado_em = now();

create or replace function public.block_delete_parametrizacao_tipos_documentos_sistema()
returns trigger
language plpgsql
as $$
begin
  if old.sistema then
    raise exception 'Tipos de documentos padrao nao podem ser excluidos. Inative o registro.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_block_delete_parametrizacao_tipos_documentos_sistema on public.parametrizacao_tipos_documentos;
create trigger trg_block_delete_parametrizacao_tipos_documentos_sistema
  before delete on public.parametrizacao_tipos_documentos
  for each row execute function public.block_delete_parametrizacao_tipos_documentos_sistema();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'parametrizacao_tipos_documentos'
  ) then
    alter publication supabase_realtime add table public.parametrizacao_tipos_documentos;
  end if;
end;
$$;
