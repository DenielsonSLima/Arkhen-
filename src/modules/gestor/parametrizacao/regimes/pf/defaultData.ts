import type { RegimeTributario } from '../types';

export const defaultPfData: RegimeTributario = {
  id: 'pf',
  title: 'Pessoa Física (Profissional Autônomo)',
  limit: 'Sem limite legal (ideal para baixos rendimentos)',
  desc: 'Tributação direta aplicada à pessoa física que atua de forma autônoma como profissional liberal ou prestador de serviços. A tributação de renda ocorre por meio da tabela progressiva mensal do IRPF (carnê-leão) e INSS (contribuinte individual).',
  positives: [
    'Dispensa formalização de CNPJ, taxas municipais e taxas de registro comercial',
    'Não exige contratação obrigatória de contador credenciado para obrigações',
    'Sem custos societários ou necessidade de elaboração de contrato social',
    'Possibilidade de escrituração de Livro Caixa para abater despesas essenciais da atividade'
  ],
  negatives: [
    'Tabela progressiva do IRPF atinge alíquotas elevadas de até 27,5% muito rápido',
    'Contribuição do INSS como autônomo de até 20% (sobre o limite máximo da previdência)',
    'Inexistência de separação patrimonial: o patrimônio pessoal responde por dívidas e processos profissionais'
  ],
  color: 'pf'
};
