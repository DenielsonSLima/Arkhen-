CREATE OR REPLACE FUNCTION public.sincronizar_status_membership_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.auth_user_id IS NOT NULL
     AND OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id THEN
    UPDATE public.perfis
    SET ativo = false, updated_at = pg_catalog.now()
    WHERE user_id = OLD.auth_user_id
      AND empresa_id = OLD.empresa_id;
  END IF;

  IF NEW.auth_user_id IS NOT NULL THEN
    UPDATE public.perfis
    SET ativo = (NEW.status = 'Ativo'),
        updated_at = pg_catalog.now()
    WHERE user_id = NEW.auth_user_id
      AND empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_status_membership_usuario()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sincronizar_status_membership_usuario_trigger
  ON public.configuracoes_usuarios;
CREATE TRIGGER sincronizar_status_membership_usuario_trigger
AFTER INSERT OR UPDATE OF status, auth_user_id, empresa_id
ON public.configuracoes_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_status_membership_usuario();
