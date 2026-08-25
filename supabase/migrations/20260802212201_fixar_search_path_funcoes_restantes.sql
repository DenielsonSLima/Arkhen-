alter function public.set_default_clientes_pastas_documentos() set search_path=public,pg_temp;
alter function public.block_delete_parametrizacao_pastas_documentos_sistema() set search_path=public,pg_temp;
alter function public.block_delete_parametrizacao_tipos_documentos_sistema() set search_path=public,pg_temp;
alter function public.set_default_clientes_modelos_ativos() set search_path=public,pg_temp;
alter function public.expand_pastas_documentos_paths(text[]) set search_path=public,pg_temp;
alter function public.set_atividades_modelos_atualizado_em() set search_path=public,pg_temp;
alter function public.set_atividades_instancias_atualizado_em() set search_path=public,pg_temp;
