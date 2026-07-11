import type {
  FiscalLocationGroup,
  FiscalMunicipalityContext,
} from './fiscalIntegrationTypes';

import { getAvailableUfs, getMunicipiosByUf } from './fiscalIntegrationCatalog';

export const stripAccents = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
};

export const normalizeUf = (uf = '') => {
  return uf.trim().toUpperCase();
};

export const normalizeMunicipio = (municipio = '') => {
  return stripAccents(municipio).replace(/\s+/g, '-') || 'municipio';
};

export const normalizeCompany = (value = '') => {
  return stripAccents(value).replace(/\s+/g, '-') || 'empresa';
};

export const makeContextKey = (input: { companyId: string; uf: string; municipio: string }) => {
  const companyId = normalizeCompany(input.companyId);
  const uf = normalizeUf(input.uf) || 'NA';
  const municipio = normalizeMunicipio(input.municipio);
  return `${companyId}__${uf}__${municipio}`;
};

export const normalizeContextInput = (input: {
  companyId: string;
  companyName: string;
  uf: string;
  municipio: string;
}) => ({
  companyId: input.companyId || 'empresa-padrao',
  companyName: input.companyName || 'Empresa de emissão',
  uf: normalizeUf(input.uf) || 'NA',
  municipio: input.municipio || 'Não informado',
  isActive: true,
});

export const groupContextsByLocation = (contextList: FiscalMunicipalityContext[]): FiscalLocationGroup[] => {
  const mapByUf = new Map<string, Map<string, FiscalMunicipalityContext[]>>();

  contextList.forEach((context) => {
    const uf = normalizeUf(context.uf) || 'NA';
    const municipio = context.municipio || 'Não informado';

    const ufMap = mapByUf.get(uf) || new Map<string, FiscalMunicipalityContext[]>();
    const cityList = ufMap.get(municipio) || [];

    cityList.push(context);
    ufMap.set(municipio, cityList);
    mapByUf.set(uf, ufMap);
  });

  return Array.from(mapByUf.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([uf, municipiosMap]) => ({
      uf,
      municipios: Array.from(municipiosMap.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
        .map(([municipio, list]) => ({
          municipio,
          contexts: list.sort((a, b) => a.companyName.localeCompare(b.companyName, 'pt-BR')),
        })),
    }));
};

export const resolveUfOptions = (): string[] => getAvailableUfs();

export const resolveMunicipios = (uf: string): string[] => getMunicipiosByUf(uf);
