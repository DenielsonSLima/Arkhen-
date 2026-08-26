export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';
export const BUSINESS_UTC_OFFSET = '-03:00';

const BUSINESS_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const BUSINESS_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const getPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) => (
  parts.find((part) => part.type === type)?.value || ''
);

export const toCalendarDateKey = (date: Date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

export const toBusinessDateKey = (date = new Date()) => {
  const parts = BUSINESS_DATE_FORMATTER.formatToParts(date);
  return `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}`;
};

export const toBusinessTimeKey = (date: Date) => {
  const parts = BUSINESS_TIME_FORMATTER.formatToParts(date);
  return `${getPart(parts, 'hour')}:${getPart(parts, 'minute')}`;
};

export const businessDateTimeIso = (dateKey: string, timeKey = '00:00') => (
  `${dateKey}T${timeKey}:00${BUSINESS_UTC_OFFSET}`
);
