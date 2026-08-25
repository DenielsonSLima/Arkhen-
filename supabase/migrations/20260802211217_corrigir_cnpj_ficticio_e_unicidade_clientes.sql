-- Recuperada do histórico remoto do Supabase.
-- A correção pontual de um registro fictício foi omitida; permanece apenas a regra estrutural.
create unique index if not exists uq_clientes_empresa_cnpj_normalizado
on public.clientes (
  empresa_id,
  regexp_replace(cnpj,'[^0-9]','','g')
)
where regexp_replace(cnpj,'[^0-9]','','g') ~ '^[0-9]{14}$'
  and regexp_replace(cnpj,'[^0-9]','','g') <> '00000000000000';
