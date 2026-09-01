export type ClienteFormStep = 'identificacao' | 'contato' | 'endereco' | 'pastas';

export const CLIENTE_FORM_STEPS: Array<{
  id: ClienteFormStep;
  label: string;
  description: string;
}> = [
  { id: 'identificacao', label: '1. Identificação', description: 'Informe documento, regime e classificações do parceiro.' },
  { id: 'contato', label: '2. Contatos', description: 'Cadastre o responsável, telefone e e-mail principal.' },
  { id: 'endereco', label: '3. Endereço fiscal', description: 'Preencha a localização fiscal da empresa ou pessoa física.' },
  { id: 'pastas', label: '4. Pastas padrão', description: 'Revise a estrutura de pastas que será criada em Documentos para o parceiro.' },
];
