import type { RotinaAtividade } from '../services/rotinasAtividadesService';

const chaveGrupo = (clienteId: string, competencia: string) => `${clienteId}:${competencia}`;

const registrar = (destino: Map<string, Set<string>>, chave: string, responsavel?: string) => {
  const nome = responsavel?.trim();
  if (!nome) return;
  const nomes = destino.get(chave) || new Set<string>();
  nomes.add(nome);
  destino.set(chave, nomes);
};

const resumirResponsaveis = (nomes: Set<string>) => (
  nomes.size === 1 ? Array.from(nomes)[0] : `Equipe (${nomes.size})`
);

export const buildResponsaveisPorGrupo = (
  rotinas: RotinaAtividade[],
) => {
  const agrupados = new Map<string, Set<string>>();

  rotinas.forEach((rotina) => {
    if (!rotina.clienteId) return;
    registrar(agrupados, chaveGrupo(rotina.clienteId, '*'), rotina.responsavel);
  });

  return Object.fromEntries(
    Array.from(agrupados.entries()).map(([chave, nomes]) => [chave, resumirResponsaveis(nomes)]),
  );
};

export const getResponsavelDoGrupo = (
  responsaveis: Record<string, string> | undefined,
  clienteId: string,
  competencia: string,
) => responsaveis?.[chaveGrupo(clienteId, competencia)]
  || responsaveis?.[chaveGrupo(clienteId, '*')]
  || 'Não atribuído';
