-- A senha de compartilhamento é exibida apenas no momento da geração.
-- A validação pública continua usando exclusivamente o hash SHA-256.
ALTER TABLE public.documentos_compartilhamentos
  DROP COLUMN IF EXISTS senha_visualizacao;
