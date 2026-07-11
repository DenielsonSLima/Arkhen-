import React from 'react';
import { Archive, File, FileText, Image, Presentation, Table2 } from 'lucide-react';
import type { StorageUsageRow } from '../services/planosContratacaoService';

export interface FileTypeGroup {
  label: string;
  ext: string[];
  color: string;
  icon: React.ReactNode;
  totalBytes: number;
  count: number;
}

const FILE_GROUPS: Omit<FileTypeGroup, 'totalBytes' | 'count'>[] = [
  { label: 'PDF', ext: ['pdf'], color: '#ef4444', icon: <FileText size={18} /> },
  { label: 'Planilhas', ext: ['xlsx', 'xls', 'csv', 'ods'], color: '#10b981', icon: <Table2 size={18} /> },
  { label: 'Documentos', ext: ['docx', 'doc', 'odt', 'txt'], color: '#3b82f6', icon: <FileText size={18} /> },
  { label: 'Imagens', ext: ['png', 'jpg', 'jpeg', 'webp', 'svg'], color: '#8b5cf6', icon: <Image size={18} /> },
  { label: 'Apresentações', ext: ['pptx', 'ppt', 'odp'], color: '#f59e0b', icon: <Presentation size={18} /> },
  { label: 'Financeiro', ext: ['ofx', 'qif', 'ret', 'rem'], color: '#0ea5e9', icon: <Archive size={18} /> },
  { label: 'Outros', ext: [], color: '#94a3b8', icon: <File size={18} /> },
];

const getExtension = (filename: string) => (filename.split('.').pop() || 'outro').toLowerCase();

export const formatCurrency = (value: number) => (
  value === 0
    ? 'Grátis'
    : `R$ ${value.toFixed(2).replace('.', ',')}`
);

export const buildFileGroups = (files: StorageUsageRow[]): FileTypeGroup[] => {
  const groups: FileTypeGroup[] = FILE_GROUPS.map((group) => ({ ...group, totalBytes: 0, count: 0 }));

  files.forEach((file) => {
    const ext = getExtension(file.nome);
    const group = groups.find((item) => item.ext.includes(ext)) || groups[groups.length - 1];
    group.totalBytes += file.tamanhoBytes;
    group.count += 1;
  });

  return groups.filter((group) => group.count > 0 || group.totalBytes > 0);
};

export const getUsageState = (percent: number) => {
  if (percent >= 100) return { label: 'Limite atingido', color: '#dc2626', tone: 'critical' as const };
  if (percent >= 80) return { label: 'Atenção', color: '#f97316', tone: 'warning' as const };
  return { label: 'Saudável', color: 'var(--color-gold-primary)', tone: 'ok' as const };
};
