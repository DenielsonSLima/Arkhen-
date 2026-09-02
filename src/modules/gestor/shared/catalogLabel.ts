const PT_BR_LOCALE = 'pt-BR';

const CANONICAL_LABELS = new Map<string, string>([
  ['pf', 'PF'],
  ['mei', 'MEI'],
  ['simples nacional', 'Simples Nacional'],
  ['lucro presumido', 'Lucro Presumido'],
  ['lucro real', 'Lucro Real'],
  ['cliente contábil', 'Cliente contábil'],
  ['parceiro comercial', 'Parceiro comercial'],
  ['pessoa física', 'Pessoa física'],
  ['empresa de pequeno porte', 'Empresa de pequeno porte'],
  ['demais', 'Demais'],
  ['imune / isenta', 'Imune / Isenta'],
  ['isenta', 'Imune / Isenta'],
  ['isenta / imune', 'Isenta / imune'],
  ['holding / patrimonial', 'Holding / patrimonial'],
  ['empresário individual', 'Empresário individual'],
  ['sociedade limitada', 'Sociedade limitada'],
  ['sociedade limitada unipessoal', 'Sociedade limitada unipessoal'],
  ['associação privada', 'Associação privada'],
  ['entidade isenta', 'Entidade isenta'],
]);

const ACRONYMS = new Map<string, string>([
  ['b2b', 'B2B'],
  ['b2c', 'B2C'],
  ['cnae', 'CNAE'],
  ['cnpj', 'CNPJ'],
  ['cpf', 'CPF'],
  ['eireli', 'EIRELI'],
  ['ei', 'EI'],
  ['epp', 'EPP'],
  ['erp', 'ERP'],
  ['ie', 'IE'],
  ['im', 'IM'],
  ['inss', 'INSS'],
  ['irpf', 'IRPF'],
  ['ltda', 'LTDA'],
  ['me', 'ME'],
  ['mei', 'MEI'],
  ['ong', 'ONG'],
  ['osc', 'OSC'],
  ['pf', 'PF'],
  ['pj', 'PJ'],
  ['s/a', 'S/A'],
  ['s.a.', 'S.A.'],
  ['saas', 'SaaS'],
  ['slu', 'SLU'],
]);

const restoreAcronyms = (value: string) => (
  value.replace(/s[/]a|s[.]a[.]|[\p{L}\p{N}]+/giu, (word) => (
    ACRONYMS.get(word.toLocaleLowerCase(PT_BR_LOCALE)) || word
  ))
);

export const normalizeCatalogLabel = (value?: string | null) => {
  const normalized = (value || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return '';

  const lowercase = normalized.toLocaleLowerCase(PT_BR_LOCALE);
  const canonical = CANONICAL_LABELS.get(lowercase);
  if (canonical) return canonical;

  const hasLetters = /\p{L}/u.test(normalized);
  const hasUniformCase = (
    normalized === normalized.toLocaleUpperCase(PT_BR_LOCALE)
    || normalized === lowercase
  );
  if (!hasLetters || !hasUniformCase) return normalized;

  const sentenceCase = `${lowercase.charAt(0).toLocaleUpperCase(PT_BR_LOCALE)}${lowercase.slice(1)}`;
  return restoreAcronyms(sentenceCase);
};
