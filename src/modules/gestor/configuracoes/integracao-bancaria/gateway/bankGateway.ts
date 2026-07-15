export type BankGatewayId = 'asaas' | 'inter';
export type BankEnvironment = 'producao' | 'homologacao';

export interface BankGatewayModule {
  id: string;
  label: string;
  description: string;
  status: 'ready' | 'planned';
}

export interface BankGatewayDefinition {
  id: BankGatewayId;
  name: string;
  tagline: string;
  logo: string;
  status: 'available' | 'planned';
  environments: BankEnvironment[];
  modules: BankGatewayModule[];
}

export const bankGateways: BankGatewayDefinition[] = [
  {
    id: 'asaas',
    name: 'Asaas',
    tagline: 'Cobranças, Pix, boleto, checkout e webhooks.',
    logo: '/integrations/banks/asaas-logo.svg',
    status: 'available',
    environments: ['producao', 'homologacao'],
    modules: [
      {
        id: 'tudo',
        label: 'Tudo',
        description: 'Visão unificada dos recursos habilitados para a conta.',
        status: 'ready',
      },
      {
        id: 'checkout',
        label: 'Checkout',
        description: 'Página hospedada para Pix, cartão, parcelamento e redirecionamento.',
        status: 'ready',
      },
      {
        id: 'pix',
        label: 'Pix',
        description: 'Cobranças com QR Code dinâmico e copia e cola.',
        status: 'ready',
      },
      {
        id: 'boleto',
        label: 'Boleto',
        description: 'Cobranças bancárias, linha digitável e PDF de boleto.',
        status: 'ready',
      },
      {
        id: 'webhook',
        label: 'Webhook',
        description: 'Eventos, token de validação e idempotência.',
        status: 'ready',
      },
    ],
  },
  {
    id: 'inter',
    name: 'Banco Inter',
    tagline: 'Boletos, Pix e webhooks com autenticação por certificado.',
    logo: '/integrations/banks/inter-empresas-logo.svg',
    status: 'available',
    environments: ['producao', 'homologacao'],
    modules: [
      {
        id: 'credenciais',
        label: 'Credenciais',
        description: 'Client ID, segredo, conta corrente e certificado mTLS.',
        status: 'ready',
      },
      {
        id: 'boleto',
        label: 'Boleto',
        description: 'Cobranças bancárias com código de barras e Pix integrado.',
        status: 'ready',
      },
      {
        id: 'pix',
        label: 'Pix',
        description: 'Recebimentos por Pix e conciliação de pagamentos.',
        status: 'ready',
      },
      {
        id: 'webhook',
        label: 'Webhook',
        description: 'Notificações assíncronas com processamento idempotente.',
        status: 'ready',
      },
    ],
  },
];

export const getBankGateway = (id: BankGatewayId) => (
  bankGateways.find((gateway) => gateway.id === id) || bankGateways[0]
);

export const getAsaasBaseUrl = (environment: BankEnvironment) => (
  environment === 'producao' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3'
);
