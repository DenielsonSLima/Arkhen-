-- Cadastros sem classificação explícita não podem assumir regime tributário;
-- remove também a antiga segunda fonte de clientes usada no navegador.
BEGIN;

ALTER TABLE public.clientes
  ALTER COLUMN tipo SET DEFAULT 'Não informado';

DELETE FROM public.preferencias_usuario_modulos
WHERE chave = 'contabil_gestao_empresarial_companies';

COMMIT;
