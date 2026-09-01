import type { Company } from '../../gestao-empresarial/services/gestaoEmpresarialService';
import type { ProtocoloEmpresaConfig } from '../services/protocolosService';
import { protocolosService } from '../services/protocolosService';

export const empresaProtocolosKeys = {
  all: ['protocolos', 'empresa-configuracao'] as const,
  detail: (company: Pick<Company, 'id' | 'tipo' | 'status' | 'tipoParceiroId'>) => [
    ...empresaProtocolosKeys.all,
    company.id,
    company.tipo,
    company.status,
    company.tipoParceiroId || 'sem-classificacao',
  ] as const,
};

export const empresaProtocolosQueries = {
  detail: (company: Company) => ({
    queryKey: empresaProtocolosKeys.detail(company),
    queryFn: () => protocolosService.getConfiguracaoEmpresa(company),
    staleTime: 30_000,
  }),
  save: ({ company, configs, expectedUpdatedAt }: {
    company: Company;
    configs: ProtocoloEmpresaConfig[];
    expectedUpdatedAt: string | null;
  }) => (
    protocolosService.saveEntregasEmpresaConfig(company, configs, expectedUpdatedAt)
  ),
};
