-- Mantem a listagem de ocorrencias sob RLS e permite que ela inicialize o
-- catalogo padrao apenas para uma empresa da qual o usuario seja membro.

ALTER FUNCTION public.agenda_seed_padroes_eventos(uuid)
  SECURITY DEFINER;
ALTER FUNCTION public.agenda_seed_padroes_eventos(uuid)
  SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.agenda_seed_padroes_eventos(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agenda_seed_padroes_eventos(uuid)
  TO authenticated;

ALTER TABLE public.agenda_padroes_eventos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.agenda_padroes_eventos TO authenticated;

ALTER FUNCTION public.listar_agenda_padroes_ocorrencias(integer, integer, integer)
  SECURITY INVOKER;
ALTER FUNCTION public.listar_agenda_padroes_ocorrencias(integer, integer, integer)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.listar_agenda_padroes_ocorrencias(integer, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_agenda_padroes_ocorrencias(integer, integer, integer)
  TO authenticated;
