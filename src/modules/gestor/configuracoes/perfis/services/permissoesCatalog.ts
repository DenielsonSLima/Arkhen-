export interface PermissaoCatalogItem {
  chave: string;
  nome: string;
  grupo: string;
}

export const permissoesCatalog: PermissaoCatalogItem[] = [
  { chave: 'inicio:view', nome: 'Ver inicio', grupo: 'Operacao' },
  { chave: 'clientes:view', nome: 'Ver clientes', grupo: 'Clientes' },
  { chave: 'clientes:create', nome: 'Criar clientes', grupo: 'Clientes' },
  { chave: 'clientes:update', nome: 'Editar clientes', grupo: 'Clientes' },
  { chave: 'clientes:delete', nome: 'Excluir clientes', grupo: 'Clientes' },
  { chave: 'parametrizacao:view', nome: 'Ver parametrizacao', grupo: 'Cadastros' },
  { chave: 'parametrizacao:manage', nome: 'Gerenciar parametrizacao', grupo: 'Cadastros' },
  { chave: 'agenda:view', nome: 'Ver agenda', grupo: 'Operacao' },
  { chave: 'agenda:manage', nome: 'Gerenciar agenda', grupo: 'Operacao' },
  { chave: 'atividades:view', nome: 'Ver atividades', grupo: 'Atividades' },
  { chave: 'atividades:manage', nome: 'Gerenciar atividades', grupo: 'Atividades' },
  { chave: 'atividades:update-own', nome: 'Atualizar proprias atividades', grupo: 'Atividades' },
  { chave: 'protocolos:view', nome: 'Ver protocolos', grupo: 'Protocolos' },
  { chave: 'protocolos:create', nome: 'Criar protocolos', grupo: 'Protocolos' },
  { chave: 'protocolos:manage', nome: 'Gerenciar protocolos', grupo: 'Protocolos' },
  { chave: 'conformidade:view', nome: 'Ver conformidade', grupo: 'Conformidade' },
  { chave: 'simulacoes:view', nome: 'Ver simulacoes', grupo: 'Simulacoes' },
  { chave: 'faturamento:view', nome: 'Ver faturamento', grupo: 'Financeiro' },
  { chave: 'faturamento:manage', nome: 'Gerenciar faturamento', grupo: 'Financeiro' },
  { chave: 'financeiro:view', nome: 'Ver financeiro', grupo: 'Financeiro' },
  { chave: 'financeiro:manage', nome: 'Gerenciar financeiro', grupo: 'Financeiro' },
  { chave: 'documentos:view', nome: 'Ver documentos', grupo: 'Documentos' },
  { chave: 'documentos:create', nome: 'Enviar documentos', grupo: 'Documentos' },
  { chave: 'documentos:manage', nome: 'Gerenciar documentos', grupo: 'Documentos' },
  { chave: 'configuracoes:view', nome: 'Ver configuracoes', grupo: 'Configuracoes' },
  { chave: 'configuracoes:manage', nome: 'Gerenciar configuracoes', grupo: 'Configuracoes' },
  { chave: 'usuarios:manage', nome: 'Gerenciar usuarios', grupo: 'Configuracoes' },
  { chave: 'perfis:manage', nome: 'Gerenciar perfis', grupo: 'Configuracoes' },
  { chave: 'contas-bancarias:manage', nome: 'Gerenciar contas bancarias', grupo: 'Financeiro' },
  { chave: 'integracao-bancaria:manage', nome: 'Gerenciar integracao bancaria', grupo: 'Financeiro' },
  { chave: 'integracao-fiscal:manage', nome: 'Gerenciar integracao fiscal', grupo: 'Fiscal' },
  { chave: 'meu-perfil:manage', nome: 'Gerenciar meu perfil', grupo: 'Conta' },
  { chave: 'cliente-portal:view', nome: 'Ver portal do cliente', grupo: 'Cliente' },
  { chave: 'documentos:view-own', nome: 'Ver proprios documentos', grupo: 'Cliente' },
  { chave: 'documentos:create-own', nome: 'Enviar proprios documentos', grupo: 'Cliente' },
  { chave: 'protocolos:view-own', nome: 'Ver proprios protocolos', grupo: 'Cliente' },
  { chave: 'atividades:view-own', nome: 'Ver proprias atividades', grupo: 'Cliente' },
  { chave: 'faturamento:view-own', nome: 'Ver proprio faturamento', grupo: 'Cliente' },
];

export const getPermissaoLabel = (chave: string) => {
  return permissoesCatalog.find((item) => item.chave === chave)?.nome || chave;
};
