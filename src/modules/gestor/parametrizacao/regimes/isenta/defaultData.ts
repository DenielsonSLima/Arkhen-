import type { RegimeTributario } from '../types';

export const defaultIsentaData: RegimeTributario = {
  id: 'isenta',
  title: 'Isenta / Imune',
  limit: 'Conforme enquadramento legal e finalidade da entidade',
  desc: 'Enquadramento usado para entidades, atividades ou operações com dispensa legal de determinados tributos, incluindo casos de imunidade, isenção ou não incidência conforme legislação aplicável.',
  positives: [
    'Permite identificar clientes com tratamento tributário diferenciado',
    'Facilita o controle de obrigações acessórias mesmo sem apuração de certos tributos',
    'Ajuda a separar rotinas fiscais comuns de rotinas específicas de entidades isentas ou imunes',
    'Evita cobrança ou simulação indevida de impostos não aplicáveis ao caso'
  ],
  negatives: [
    'Exige validação documental e legal do enquadramento',
    'Pode manter obrigações acessórias mesmo sem imposto principal a recolher',
    'Perda de requisitos legais pode descaracterizar a isenção ou imunidade'
  ],
  color: 'isenta'
};
