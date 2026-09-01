import type { CatalogoItem } from '../../parametrizacao/services/catalogosService';
import { normalizeCatalogLabel } from '../../shared/catalogLabel';

export interface PartnerCategoryOption {
  id: string;
  nome: string;
}

type NamedOption = PartnerCategoryOption;

export const normalizePartnerClassificationName = (value: string) => (
  normalizeCatalogLabel(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ')
);

const deduplicateNamedOptions = <T extends NamedOption>(
  options: readonly T[],
  selectedOption?: T,
) => {
  const prioritizedOptions = selectedOption
    ? [selectedOption, ...options.filter((item) => item !== selectedOption)]
    : options;
  const ids = new Set<string>();
  const names = new Set<string>();

  return prioritizedOptions.filter((item) => {
    const id = item.id.trim();
    const normalizedName = normalizePartnerClassificationName(item.nome);
    if ((id && ids.has(id)) || (normalizedName && names.has(normalizedName))) return false;

    if (id) ids.add(id);
    if (normalizedName) names.add(normalizedName);
    return true;
  });
};

export const getUniqueCatalogOptions = (
  options: CatalogoItem[],
  selectedId: string,
) => {
  const normalizedId = selectedId.trim();
  const selectedOption = normalizedId
    ? options.find((item) => item.id.trim() === normalizedId)
    : undefined;
  return deduplicateNamedOptions(options, selectedOption);
};

export const getUniquePartnerCategoryOptions = (
  options: PartnerCategoryOption[],
  selectedName: string,
) => {
  const normalizedSelectedName = normalizePartnerClassificationName(selectedName);
  const selectedOption = options.find((item) => item.nome === selectedName)
    || options.find((item) => (
      normalizedSelectedName
      && normalizePartnerClassificationName(item.nome) === normalizedSelectedName
    ));
  return deduplicateNamedOptions(options, selectedOption);
};

export const getSelectedPartnerCategoryValue = (
  options: PartnerCategoryOption[],
  selectedName: string,
) => {
  const normalizedSelectedName = normalizePartnerClassificationName(selectedName);
  if (!normalizedSelectedName) return '';

  return options.find((item) => (
    normalizePartnerClassificationName(item.nome) === normalizedSelectedName
  ))?.nome || '';
};

export const hasSelectedPartnerCategory = (
  options: PartnerCategoryOption[],
  selectedName: string,
) => Boolean(getSelectedPartnerCategoryValue(options, selectedName));
