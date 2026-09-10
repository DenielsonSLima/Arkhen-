export const formatLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Preserve the existing 1–28 day rule, comparing civil dates instead of clock time.
export const nextMonthlyDueDate = (day: number, today = new Date()) => {
  const due = new Date(today.getFullYear(), today.getMonth(), Math.min(Math.max(day, 1), 28));
  if (formatLocalISODate(due) < formatLocalISODate(today)) due.setMonth(due.getMonth() + 1);
  return formatLocalISODate(due);
};
