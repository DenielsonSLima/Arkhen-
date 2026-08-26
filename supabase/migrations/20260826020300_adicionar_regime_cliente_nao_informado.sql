-- Permite importar cadastros operacionais incompletos sem atribuir um regime
-- tributário incorreto. O usuário deve completar a classificação depois.
alter table public.clientes
  drop constraint if exists clientes_tipo_check;

alter table public.clientes
  add constraint clientes_tipo_check
  check (tipo = any (array[
    'Não informado'::text,
    'PF'::text,
    'MEI'::text,
    'Simples Nacional'::text,
    'Lucro Presumido'::text,
    'Lucro Real'::text,
    'Isenta'::text
  ]));
