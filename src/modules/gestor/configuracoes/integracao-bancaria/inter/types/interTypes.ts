import type { BankEnvironment } from '../../gateway/bankGateway';

export type InterIntegrationStatus = 'em_validacao' | 'configurado' | 'pendente' | 'erro';

export interface InterEnvironmentConfig {
  clientId: string;
  clientIdConfigured: boolean;
  clientSecret: string;
  clientSecretConfigured: boolean;
  certificatePem: string;
  certificateConfigured: boolean;
  certificateFileName: string;
  certificateValidFrom: string;
  certificateValidUntil: string;
  privateKeyPem: string;
  privateKeyConfigured: boolean;
  privateKeyFileName: string;
  contaCorrente: string;
  chavePix: string;
  clearClientSecret: boolean;
  clearCertificate: boolean;
  clearPrivateKey: boolean;
  boletoAtivo: boolean;
  pixAtivo: boolean;
  webhookAtivo: boolean;
  webhookUrl: string;
}

export interface InterIntegrationConfig {
  activeEnvironment: BankEnvironment;
  status: InterIntegrationStatus;
  environments: Record<BankEnvironment, InterEnvironmentConfig>;
}

export interface InterConnectionResult {
  ok: boolean;
  message: string;
  checkedAt?: string;
  certificateValidFrom?: string;
  certificateValidUntil?: string;
  certificateDaysRemaining?: number;
}
