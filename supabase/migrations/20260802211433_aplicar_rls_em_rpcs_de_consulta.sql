alter function public.get_conformidade_operacional(uuid) security invoker;
alter function public.get_faturamento_dashboard(date,date,uuid,text) security invoker;
alter function public.get_faturamento_inadimplencia(integer,text) security invoker;
alter function public.get_faturamento_nfse(text,text) security invoker;
alter function public.get_faturamento_recorrencias() security invoker;
alter function public.get_financeiro_dashboard(integer) security invoker;
alter function public.get_planejamento_clientes() security invoker;
alter function public.get_planejamento_historico() security invoker;
alter function public.get_relatorio_conformidade_json(uuid) security invoker;
alter function public.get_relatorio_faturamento_json(uuid,date,date) security invoker;
alter function public.get_relatorio_pessoal_json(uuid) security invoker;
alter function public.get_contas_bancarias_resumo() security invoker;
alter function public.listar_agenda_padroes_ocorrencias(integer,integer,integer) security invoker;
alter function public.listar_configuracoes_modulos_sistema() security invoker;
alter function public.listar_reforma_tributaria_historico(uuid) security invoker;
alter function public.listar_reforma_tributaria_painel() security invoker;

revoke execute on function public.ensure_atividades_instancias(character varying) from authenticated;
