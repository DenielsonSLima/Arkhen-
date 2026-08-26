import {
  Calendar as CalendarIcon,
  ClipboardList,
  Hammer,
  Receipt,
  UserCheck,
  Users,
} from 'lucide-react';

export const isRealLogo = (logo: string | undefined): boolean => {
  if (!logo) return false;
  const trimmed = logo.trim();
  return trimmed.startsWith('data:image/')
    || trimmed.startsWith('http://')
    || trimmed.startsWith('https://')
    || trimmed.startsWith('/');
};

export const renderCompanyLogo = (
  logo: string | undefined,
  name: string,
  regime: string,
  size: 'small' | 'large' = 'small',
) => {
  const isLarge = size === 'large';
  const dimensions = isLarge
    ? { width: '56px', height: '56px', fontSize: '1.2rem', borderRadius: '12px' }
    : { width: '36px', height: '36px', fontSize: '0.8rem', borderRadius: '8px' };

  if (isRealLogo(logo)) {
    return (
      <img
        src={logo}
        alt={name}
        style={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.borderRadius,
          objectFit: 'cover',
          border: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      />
    );
  }

  const initials = name
    .split(' ')
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

  let gradient = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
  if (regime === 'Simples Nacional') {
    gradient = 'linear-gradient(135deg, #10b981 0%, #047857 100%)';
  } else if (regime === 'Lucro Presumido') {
    gradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
  } else if (regime === 'Lucro Real') {
    gradient = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
  } else if (regime === 'Isenta' || regime === 'Isento') {
    gradient = 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)';
  } else if (regime === 'PF') {
    gradient = 'linear-gradient(135deg, #a16207 0%, #854d0e 100%)';
  }

  return (
    <div style={{
      width: dimensions.width,
      height: dimensions.height,
      borderRadius: dimensions.borderRadius,
      background: gradient,
      color: '#ffffff',
      fontWeight: 700,
      fontSize: isLarge ? '1.2rem' : '0.8rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {initials || 'CO'}
    </div>
  );
};

export const getActivityMiniIcon = (modeloId: string, status: string, size = 13) => {
  let color = '#94a3b8';
  if (status === 'Concluída') color = '#10b981';
  else if (status === 'Em andamento') color = '#f59e0b';
  else if (status === 'Pendente') color = '#ef4444';

  switch (modeloId) {
    case 'folha':
      return <Users size={size} style={{ color }} />;
    case 'prolabore':
      return <UserCheck size={size} style={{ color }} />;
    case 'dctfweb':
      return <Receipt size={size} style={{ color }} />;
    case 'obrigacoes':
      return <CalendarIcon size={size} style={{ color }} />;
    case 'obras':
      return <Hammer size={size} style={{ color }} />;
    default:
      return <ClipboardList size={size} style={{ color }} />;
  }
};
