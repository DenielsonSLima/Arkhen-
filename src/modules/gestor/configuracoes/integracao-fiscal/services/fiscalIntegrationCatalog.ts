import { getKnownUfsWithPrefeituras, getMunicipiosFromPrefeituras } from './prefeituras';

export const BASE_CITIES = ['Não informado'];

export const MUNICIPIOS_POR_UF: Record<string, string[]> = {
  AC: ['Rio Branco', 'Cruzeiro do Sul'],
  AL: ['Maceió', 'Arapiraca', 'Palmeira dos Índios'],
  AP: ['Macapá', 'Santana', 'Oiapoque'],
  AM: ['Manaus', 'Parintins', 'Itacoatiara'],
  BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista'],
  CE: ['Fortaleza', 'Juazeiro do Norte', 'Caucaia'],
  DF: ['Brasília', 'Taguatinga', 'Ceilândia'],
  ES: ['Vitória', 'Vila Velha', 'Serra'],
  GO: ['Goiânia', 'Aparecida de Goiânia', 'Anápolis'],
  MA: ['São Luís', 'Imperatriz', 'Caxias'],
  MT: ['Cuiabá', 'Várzea Grande', 'Rondonópolis'],
  MS: ['Campo Grande', 'Dourados', 'Três Lagoas'],
  MG: ['Belo Horizonte', 'Uberlândia', 'Contagem', 'Juiz de Fora'],
  PA: ['Belém', 'Ananindeua', 'Castanhal'],
  PB: ['João Pessoa', 'Campina Grande', 'Patos'],
  PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa'],
  PE: ['Recife', 'Jaboatão dos Guararapes', 'Olinda'],
  PI: ['Teresina', 'Parnaíba', 'Picos'],
  RJ: ['Rio de Janeiro', 'Niterói', 'Petrópolis', 'Campos dos Goytacazes'],
  RN: ['Natal', 'Mossoró', 'Parnamirim'],
  RS: ['Porto Alegre', 'Caxias do Sul', 'Pelotas', 'Novo Hamburgo'],
  RO: ['Porto Velho', 'Ji-Paraná', 'Ariquemes'],
  RR: ['Boa Vista', 'Rorainópolis', 'Caracaraí'],
  SC: ['Florianópolis', 'Joinville', 'Blumenau', 'Chapecó'],
  SP: ['São Paulo', 'Campinas', 'São Bernardo do Campo', 'Santos', 'Ribeirão Preto'],
  SE: ['Aracaju', 'Itabaiana', 'Nossa Senhora do Socorro', 'Lagarto'],
  TO: ['Palmas', 'Araguaína', 'Gurupi'],
};

export const getAvailableUfs = () => {
  const merged = new Set([
    ...Object.keys(MUNICIPIOS_POR_UF),
    ...getKnownUfsWithPrefeituras(),
  ]);
  return Array.from(merged).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

const mergeUnique = (items: string[]) => [...new Set(items)].sort((a, b) => a.localeCompare(b, 'pt-BR'));

export const getMunicipiosByUf = (uf: string) => {
  const normalizedUf = (uf || '').trim().toUpperCase();
  const municipios = MUNICIPIOS_POR_UF[normalizedUf] || [];
  const municipaisPorPerfil = getMunicipiosFromPrefeituras(normalizedUf);
  const combined = mergeUnique([...municipios, ...municipaisPorPerfil]);

  return combined.length > 0 ? combined : BASE_CITIES;
};
