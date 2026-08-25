alter function public.baixar_manual_cobranca_custom(uuid,date,text,numeric,numeric,numeric,text,boolean,uuid) security invoker;
alter function public.cancelar_cobranca_financeira(uuid) security invoker;
alter function public.confirmar_recebimento_financeiro(uuid) security invoker;
alter function public.pagar_despesa_financeira(uuid,uuid,date,numeric,numeric,numeric,text) security invoker;
alter function public.salvar_conta_bancaria(jsonb) security invoker;
alter function public.salvar_contrato_financeiro(jsonb) security invoker;
alter function public.salvar_lancamento_financeiro(jsonb) security invoker;
alter function public.salvar_planejamento_tributario(uuid,text) security invoker;
alter function public.salvar_agenda_padroes_eventos(jsonb) security invoker;
alter function public.upsert_configuracoes_empresa(jsonb) security invoker;
alter function public.upsert_configuracoes_marca_dagua(jsonb) security invoker;
alter function public.upsert_configuracoes_perfil_acesso(uuid,text,text,text[]) security invoker;
alter function public.desativar_configuracoes_perfil_acesso(uuid) security invoker;
alter function public.set_contador_responsavel(uuid) security invoker;

revoke execute on function public.agenda_seed_padroes_eventos(uuid) from authenticated;
revoke execute on function public.seed_pastas_documentos_padrao_empresa(uuid) from authenticated;
revoke execute on function public.seed_perfis_acesso_empresa(uuid) from authenticated;
