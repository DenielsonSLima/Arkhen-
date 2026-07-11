-- Adiciona a coluna senha_visualizacao para armazenar a senha em texto plano no banco de dados.
ALTER TABLE public.documentos_compartilhamentos
  ADD COLUMN IF NOT EXISTS senha_visualizacao text;
