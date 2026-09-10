import { BookOpen, Calculator, CalendarDays, ChartColumn, Database, FileCheck, FolderOpen,
  Landmark, LayoutDashboard, ListChecks, Receipt, Scale, Settings, Users } from 'lucide-react';

const ICONS = { Calculator, CalendarDays, ChartColumn, Database, FileCheck, FolderOpen,
  Landmark, LayoutDashboard, ListChecks, Receipt, Scale, Settings, Users };

export function GuideIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = ICONS[name as keyof typeof ICONS] || BookOpen;
  return <Icon size={size} aria-hidden="true" />;
}
