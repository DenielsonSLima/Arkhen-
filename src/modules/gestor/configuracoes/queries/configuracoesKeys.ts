export const configuracoesKeys = {
  all: ['configuracoes'] as const,
  empresa: () => [...configuracoesKeys.all, 'empresa'] as const,
  marcaDagua: () => [...configuracoesKeys.all, 'marca-dagua'] as const,
  perfisAcesso: () => [...configuracoesKeys.all, 'perfis-acesso'] as const,
  usuarios: () => [...configuracoesKeys.all, 'usuarios'] as const,
  xmlModelos: () => [...configuracoesKeys.all, 'xml-modelos'] as const,
};
