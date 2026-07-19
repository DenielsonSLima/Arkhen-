-- DELETE no Realtime precisa dos campos de roteamento (empresa/user/módulo),
-- não apenas da chave primária, para remover o valor correto do cache da SPA.
ALTER TABLE public.preferencias_usuario_modulos REPLICA IDENTITY FULL;
