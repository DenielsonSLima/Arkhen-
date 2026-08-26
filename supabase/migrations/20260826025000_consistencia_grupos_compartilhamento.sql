-- Valida o grupo ao fim da transacao para permitir renovacao atomica de todos os arquivos.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.documentos_compartilhamentos base
    JOIN public.documentos_compartilhamentos peer
      ON peer.share_group_id = base.share_group_id
     AND peer.id <> base.id
    WHERE peer.empresa_id <> base.empresa_id
       OR peer.tempo_limite <> base.tempo_limite
       OR peer.senha_hash IS DISTINCT FROM base.senha_hash
       OR peer.expires_at IS DISTINCT FROM base.expires_at
       OR peer.status <> base.status
  ) THEN
    RAISE EXCEPTION
      'Existem grupos de compartilhamento inconsistentes; corrija-os antes desta migration.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_document_share_group_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.documentos_compartilhamentos peer
    WHERE peer.share_group_id = NEW.share_group_id
      AND peer.id <> NEW.id
      AND (
        peer.empresa_id <> NEW.empresa_id
        OR peer.tempo_limite <> NEW.tempo_limite
        OR peer.senha_hash IS DISTINCT FROM NEW.senha_hash
        OR peer.expires_at IS DISTINCT FROM NEW.expires_at
        OR peer.status <> NEW.status
      )
  ) THEN
    RAISE EXCEPTION 'Grupo de compartilhamento inconsistente.' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS assert_document_share_group_consistency_trigger
  ON public.documentos_compartilhamentos;
CREATE CONSTRAINT TRIGGER assert_document_share_group_consistency_trigger
  AFTER INSERT OR UPDATE ON public.documentos_compartilhamentos
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_document_share_group_consistency();

REVOKE ALL ON FUNCTION public.assert_document_share_group_consistency()
  FROM PUBLIC, anon, authenticated;

COMMIT;
