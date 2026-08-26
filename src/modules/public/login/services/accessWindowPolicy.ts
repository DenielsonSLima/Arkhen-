import type { UsuarioAccessConfig } from '../../../gestor/configuracoes/usuarios/services/usuariosService';

const ACCESS_TIME_ZONE = 'America/Sao_Paulo';
const WEEKDAY_BY_LABEL: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

export const getAccessClock = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ACCESS_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((part) => part.type === type)?.value || ''
  );
  const day = WEEKDAY_BY_LABEL[getPart('weekday')];
  const hour = Number(getPart('hour'));
  const minute = Number(getPart('minute'));

  return {
    day: Number.isInteger(day) ? day : 0,
    minutes: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
  };
};

export const validateAccessWindow = (config: UsuarioAccessConfig, date = new Date()) => {
  if (!config.enabled) return { allowed: true, message: '' };

  const current = getAccessClock(date);
  const dayAllowed = config.days.includes(current.day);
  const timeAllowed = config.intervals.some((interval) => {
    const start = timeToMinutes(interval.start);
    const end = timeToMinutes(interval.end);
    return current.minutes >= start && current.minutes <= end;
  });

  if (dayAllowed && timeAllowed) return { allowed: true, message: '' };
  return {
    allowed: false,
    message: config.message || 'Seu acesso não está permitido neste dia ou horário. Entre em contato com o gestor.',
  };
};
