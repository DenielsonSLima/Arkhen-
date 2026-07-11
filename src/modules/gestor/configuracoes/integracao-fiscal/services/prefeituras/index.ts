import type { FiscalPrefeituraProfile, FiscalAmbienteTipo } from './types';
import { PREFEITURAS_SE } from './se/index';

const PREFEITURAS_BY_UF: Record<string, FiscalPrefeituraProfile[]> = {
  SE: [...PREFEITURAS_SE],
};

const normalize = (value: string) => (value || '').trim().toLowerCase();
const normalizeMunicipio = (value: string) => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

export const getPrefeituraProfilesByUf = (uf: string): FiscalPrefeituraProfile[] => {
  const normalizedUf = normalize(uf).toUpperCase();
  return PREFEITURAS_BY_UF[normalizedUf] || [];
};

export const getAllPrefeituraProfiles = (): FiscalPrefeituraProfile[] => {
  return Object
    .values(PREFEITURAS_BY_UF)
    .flatMap((profiles) => profiles);
};

export const getPrefeituraProfile = (uf: string, municipio: string): FiscalPrefeituraProfile | null => {
  const targetUf = normalize(uf).toUpperCase();
  const targetMunicipio = normalizeMunicipio(municipio);
  return (
    getPrefeituraProfilesByUf(targetUf).find((profile) => normalizeMunicipio(profile.municipio) === targetMunicipio) || null
  );
};

export const getMunicipiosFromPrefeituras = (uf: string): string[] => {
  return getPrefeituraProfilesByUf(uf).map((profile) => profile.municipio);
};

export const getKnownUfsWithPrefeituras = (): string[] => {
  return Object.keys(PREFEITURAS_BY_UF).sort();
};

export const getEnvironmentUrlForProfile = (
  profile: FiscalPrefeituraProfile | null,
  ambiente: FiscalAmbienteTipo,
): string => {
  if (!profile) {
    return '';
  }

  return ambiente === 'producao'
    ? profile.ambientes.producao.url
    : profile.ambientes.homologacao.url;
};
