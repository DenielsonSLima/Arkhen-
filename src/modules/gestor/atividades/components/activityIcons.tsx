import {
  Calendar as CalendarIcon,
  ClipboardList,
  Hammer,
  Receipt,
  UserCheck,
  Users,
} from 'lucide-react';

export const getActivityIcon = (modeloId: string, status: string, size = 15) => {
  let color = '#94a3b8';
  if (status === 'Concluída') color = '#10b981';
  else if (status === 'Em andamento') color = '#f59e0b';
  else if (status === 'Pendente') color = '#ef4444';

  switch (modeloId) {
    case 'folha':
    case 'folha-pagamento':
      return <Users size={size} style={{ color }} />;
    case 'prolabore':
    case 'pro-labore':
      return <UserCheck size={size} style={{ color }} />;
    case 'dctfweb':
    case 'dctfweb-tributos-federais':
      return <Receipt size={size} style={{ color }} />;
    case 'obrigacoes':
    case 'obrigacoes-mensais':
      return <CalendarIcon size={size} style={{ color }} />;
    case 'obras':
      return <Hammer size={size} style={{ color }} />;
    default:
      return <ClipboardList size={size} style={{ color }} />;
  }
};
