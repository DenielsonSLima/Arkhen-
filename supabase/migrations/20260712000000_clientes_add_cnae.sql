ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cnae text,
  ADD COLUMN IF NOT EXISTS cnae_descricao text;
