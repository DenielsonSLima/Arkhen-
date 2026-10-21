-- Apply only after the frontend no longer offers Reforma Tributaria.
-- Empty-data preflight captured 2026-10-21; abort on drift, never delete new RTC data.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, pg_catalog;
LOCK TABLE public.reforma_tributaria_decisoes,
  public.reforma_tributaria_simulacoes, public.reforma_tributaria_validacoes_xml,
  public.reforma_tributaria_adequacoes, public.configuracoes_modulos_sistema,
  public.configuracoes_modulos_auditoria, public.configuracoes_perfis_acesso,
  public.preferencias_sidebar_menu, public.preferencias_usuario_modulos
  IN ACCESS EXCLUSIVE MODE;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.reforma_tributaria_adequacoes)
    OR EXISTS (SELECT 1 FROM public.reforma_tributaria_validacoes_xml)
    OR EXISTS (SELECT 1 FROM public.reforma_tributaria_simulacoes)
    OR EXISTS (SELECT 1 FROM public.reforma_tributaria_decisoes)
    OR EXISTS (SELECT 1 FROM public.configuracoes_modulos_sistema WHERE modulo = 'reforma-tributaria')
    OR EXISTS (SELECT 1 FROM public.configuracoes_modulos_auditoria WHERE modulo = 'reforma-tributaria') THEN
    RAISE EXCEPTION 'RTC data appeared after preflight; abort and review before removal.';
  END IF;
  IF (SELECT count(*) FROM public.configuracoes_perfis_acesso
      WHERE permissoes && ARRAY['reforma-tributaria:view','reforma-tributaria:manage']) > 2
    OR (SELECT count(*) FROM public.preferencias_sidebar_menu
      WHERE 'reforma-tributaria' = ANY(menu_order)) > 1 THEN
    RAISE EXCEPTION 'RTC profile/menu counts changed; review required.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.preferencias_usuario_modulos
      WHERE (modulo LIKE '%reforma%' OR chave LIKE '%reforma%' OR valor::text LIKE '%reforma%')
        AND NOT (modulo = 'app-local-storage' AND chave = 'arkhen_sidebar_menu_order'))
    OR (SELECT count(*) FROM public.preferencias_usuario_modulos
      WHERE modulo = 'app-local-storage' AND chave = 'arkhen_sidebar_menu_order'
        AND valor::text LIKE '%reforma%') > 1 THEN
    RAISE EXCEPTION 'Unexpected RTC preferences; review required.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.preferencias_usuario_modulos
      WHERE modulo = 'app-local-storage' AND chave = 'arkhen_sidebar_menu_order'
        AND valor::text LIKE '%reforma%'
        AND (jsonb_typeof(valor) <> 'string' OR jsonb_typeof((valor #>> '{}')::jsonb) <> 'array')) THEN
    RAISE EXCEPTION 'Unexpected serialized sidebar format.';
  END IF;
END;
$guard$;

-- CREATE OR REPLACE retains ownership and ACL; guard the exact reviewed source.
-- Only the RTC catalog item and maximum allowed module count may change.
DO $patch$
DECLARE
  v_oid oid; v_definition text; v_before_acl aclitem[]; v_after_acl aclitem[];
BEGIN
  v_oid := 'public.listar_configuracoes_modulos_sistema()'::regprocedure;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = v_oid) <> 'fe0fbd21579d3de59fee4feaaaea44c9' THEN
    RAISE EXCEPTION 'Shared function changed: listar_configuracoes_modulos_sistema()';
  END IF;
  SELECT pg_get_functiondef(oid), proacl INTO v_definition, v_before_acl FROM pg_proc WHERE oid = v_oid;
  v_definition := replace(v_definition, $old$      ('reforma-tributaria', 'Reforma Tributária', 'Adequação, XML, IBS/CBS e split payment.', 'Tributário', false, 70, ARRAY['reforma-tributaria:view','reforma-tributaria:manage']),
$old$, $new$$new$);
  EXECUTE v_definition;
  SELECT proacl INTO v_after_acl FROM pg_proc WHERE oid = v_oid;
  IF v_after_acl IS DISTINCT FROM v_before_acl THEN RAISE EXCEPTION 'Shared ACL changed'; END IF;
  v_oid := 'public.modulo_sistema_habilitado(text)'::regprocedure;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = v_oid) <> 'e2ffe8ef3d4827cd2c0dc7a088abb78d' THEN
    RAISE EXCEPTION 'Shared function changed: modulo_sistema_habilitado(text)';
  END IF;
  SELECT pg_get_functiondef(oid), proacl INTO v_definition, v_before_acl FROM pg_proc WHERE oid = v_oid;
  v_definition := replace(v_definition, $old$, 'reforma-tributaria'$old$, $new$$new$);
  EXECUTE v_definition;
  SELECT proacl INTO v_after_acl FROM pg_proc WHERE oid = v_oid;
  IF v_after_acl IS DISTINCT FROM v_before_acl THEN RAISE EXCEPTION 'Shared ACL changed'; END IF;
  v_oid := 'public.salvar_configuracoes_modulos_sistema(jsonb)'::regprocedure;
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = v_oid) <> '8155201903c273600a65c13faaf6fae3' THEN
    RAISE EXCEPTION 'Shared function changed: salvar_configuracoes_modulos_sistema(jsonb)';
  END IF;
  SELECT pg_get_functiondef(oid), proacl INTO v_definition, v_before_acl FROM pg_proc WHERE oid = v_oid;
  v_definition := replace(v_definition, $old$, 'reforma-tributaria'$old$, $new$$new$);
  v_definition := replace(v_definition, 'jsonb_array_length(p_modulos) > 9', 'jsonb_array_length(p_modulos) > 8');
  EXECUTE v_definition;
  SELECT proacl INTO v_after_acl FROM pg_proc WHERE oid = v_oid;
  IF v_after_acl IS DISTINCT FROM v_before_acl THEN RAISE EXCEPTION 'Shared ACL changed'; END IF;
END;
$patch$;

ALTER TABLE public.configuracoes_modulos_sistema
  DROP CONSTRAINT configuracoes_modulos_sistema_modulo_check RESTRICT;
ALTER TABLE public.configuracoes_modulos_sistema
  ADD CONSTRAINT configuracoes_modulos_sistema_modulo_check CHECK (modulo IN (
    'inicio', 'clientes', 'atividades', 'protocolos', 'simulacoes-calculos',
    'faturamento', 'financeiro', 'documentos', 'agenda', 'parametrizacao', 'configuracoes'
  ));

DROP TRIGGER aplicar_permissoes_reforma_perfil_padrao
  ON public.configuracoes_perfis_acesso RESTRICT;
UPDATE public.configuracoes_perfis_acesso
  SET permissoes = array_remove(array_remove(permissoes,
    'reforma-tributaria:view'), 'reforma-tributaria:manage')
  WHERE permissoes && ARRAY['reforma-tributaria:view','reforma-tributaria:manage'];
UPDATE public.preferencias_sidebar_menu
  SET menu_order = array_remove(menu_order, 'reforma-tributaria')
  WHERE 'reforma-tributaria' = ANY(menu_order);
-- Preserve JSONB string storage (the array is serialized inside the string).
UPDATE public.preferencias_usuario_modulos p
SET valor = to_jsonb((SELECT coalesce(jsonb_agg(item ORDER BY ordinal), '[]'::jsonb)::text
  FROM jsonb_array_elements((p.valor #>> '{}')::jsonb) WITH ORDINALITY AS menu(item, ordinal)
  WHERE item <> '"reforma-tributaria"'::jsonb))
WHERE modulo = 'app-local-storage' AND chave = 'arkhen_sidebar_menu_order'
  AND valor::text LIKE '%reforma%';

-- Dependent RTC tables first. RESTRICT intentionally aborts on unknown dependencies.
DROP TABLE public.reforma_tributaria_decisoes RESTRICT;
DROP TABLE public.reforma_tributaria_simulacoes RESTRICT;
DROP TABLE public.reforma_tributaria_validacoes_xml RESTRICT;
DROP TABLE public.reforma_tributaria_adequacoes RESTRICT;
DROP FUNCTION
  public.aplicar_permissoes_reforma_perfil_padrao(),
  public.atualizar_reforma_tributaria_checklist(uuid,text,boolean),
  public.listar_reforma_tributaria_historico(uuid),
  public.listar_reforma_tributaria_painel(),
  public.reforma_tributaria_cliente_autorizado(uuid),
  public.reforma_tributaria_numero(jsonb,text,numeric),
  public.reforma_tributaria_status_checklist(jsonb),
  public.reforma_tributaria_tem_permissao(text),
  public.reforma_tributaria_xml_text(xml,text),
  public.salvar_reforma_simulacao_ibs_cbs(uuid,jsonb),
  public.salvar_reforma_simulacao_split_payment(uuid,jsonb),
  public.salvar_reforma_tributaria_adequacao(uuid,jsonb),
  public.salvar_reforma_tributaria_decisao(uuid,jsonb),
  public.validar_reforma_tributaria_xml(uuid,jsonb)
  RESTRICT;

DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
      AND (proname LIKE '%reforma%' OR (proname IN (
        'listar_configuracoes_modulos_sistema','modulo_sistema_habilitado',
        'salvar_configuracoes_modulos_sistema') AND prosrc LIKE '%reforma%')))
    OR EXISTS (SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace
      AND relname LIKE 'reforma_tributaria_%') THEN
    RAISE EXCEPTION 'Unexpected RTC object remains; rollback required.';
  END IF;
END;
$verify$;

COMMIT;
