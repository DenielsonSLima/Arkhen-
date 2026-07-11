import React from 'react';
import { Eye, Edit2, Trash2, FileText, Table2, CreditCard, Image as ImageIcon, Presentation, FileCode2 } from 'lucide-react';
import type { CompanyDocument } from '../services/gestaoEmpresarialService';

interface DocumentTableViewProps {
  documents: CompanyDocument[];
  onPreview: (document: CompanyDocument) => void;
  onRename?: (docId: string, currentName: string) => void;
  onMove?: (docId: string) => void;
  onDelete?: (docId: string) => void;
  selectedDocIds?: string[];
  onToggleSelect?: (docId: string) => void;
  showCheckboxes?: boolean;
  variant?: 'default' | 'compact';
}

export const DocumentTableView: React.FC<DocumentTableViewProps> = ({
  documents,
  onPreview,
  onRename,
  onMove,
  onDelete,
  selectedDocIds = [],
  onToggleSelect,
  showCheckboxes = false,
  variant = 'default',
}) => {
  const isCompact = variant === 'compact';
  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return <FileText size={20} style={{ color: '#ef4444' }} />;
      case 'xlsx':
      case 'xls':
        return <Table2 size={20} style={{ color: '#10b981' }} />;
      case 'docx':
      case 'doc':
        return <FileText size={20} style={{ color: '#3b82f6' }} />;
      case 'pptx':
      case 'ppt':
        return <Presentation size={20} style={{ color: '#f59e0b' }} />;
      case 'xml':
        return <FileCode2 size={20} style={{ color: '#c59235' }} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
        return <ImageIcon size={20} style={{ color: '#6b7280' }} />;
      case 'ofx':
        return <CreditCard size={20} style={{ color: '#1e1b4b' }} />;
      default:
        return <FileText size={20} style={{ color: '#94a3b8' }} />;
    }
  };

  const getDocBadgeClass = (tipo: string) => {
    switch (tipo) {
      case 'Contrato Social': return 'real';
      case 'GFIP': return 'simples';
      case 'Folha de Pagamento': return 'real';
      case 'CND': return 'mei';
      default: return 'inativa';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const getValidadeBadge = (dataValidade?: string) => {
    if (!dataValidade) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const val = new Date(dataValidade + 'T00:00:00');
    const dias = Math.round((val.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    if (dias < 0) return { label: `Vencido`, bg: '#fef2f2', color: '#ef4444' };
    if (dias <= 15) return { label: `Vence em ${dias}d`, bg: '#fff7ed', color: '#f97316' };
    return { label: formatDate(dataValidade), bg: '#f0fdf4', color: '#22c55e' };
  };

  return (
    <div className="table-responsive-wrapper">
      <table className="premium-table">
        <thead>
          <tr>
            {showCheckboxes && <th style={{ width: '40px', padding: isCompact ? '6px 16px' : undefined }}></th>}
            <th style={{ padding: isCompact ? '6px 16px' : undefined }}>Nome do Arquivo</th>
            <th style={{ padding: isCompact ? '6px 16px' : undefined }}>Tipo</th>
            {!isCompact && <th style={{ padding: isCompact ? '6px 16px' : undefined }}>Upload em</th>}
            <th style={{ padding: isCompact ? '6px 16px' : undefined }}>Tamanho</th>
            {!isCompact && <th style={{ padding: isCompact ? '6px 16px' : undefined }}>Validade</th>}
            <th style={{ textAlign: 'right', padding: isCompact ? '6px 16px' : undefined }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr
              key={doc.id}
              onDoubleClick={() => onPreview(doc)}
              draggable={Boolean(onMove)}
              onDragStart={(event) => {
                if (!onMove) return;
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('application/x-documentos-item', JSON.stringify({ kind: 'document', id: doc.id }));
                event.dataTransfer.setData('text/plain', doc.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              {showCheckboxes && (
                <td style={{ width: '40px', verticalAlign: 'middle', padding: isCompact ? '6px 16px' : undefined }}>
                  <input
                    type="checkbox"
                    checked={selectedDocIds.includes(doc.id)}
                    onChange={() => onToggleSelect?.(doc.id)}
                    onDoubleClick={(event) => event.stopPropagation()}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                </td>
              )}
              <td style={{ padding: isCompact ? '6px 16px' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getFileIcon(doc.nome)}
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: isCompact ? '0.8rem' : undefined }}>{doc.nome}</span>
                    {doc.descricao && !isCompact && (
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'normal', marginTop: '1px' }}>
                        {doc.descricao}
                      </span>
                    )}
                    {(doc as any).empresaNome && !isCompact && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--color-gold-dark)', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        🏢 {(doc as any).empresaNome}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td style={{ padding: isCompact ? '6px 16px' : undefined }}>
                <span className={`regime-badge ${getDocBadgeClass(doc.tipo)}`} style={{ padding: isCompact ? '2px 6px' : undefined, fontSize: isCompact ? '0.7rem' : undefined }}>
                  {doc.tipo}
                </span>
              </td>
              {!isCompact && <td style={{ padding: isCompact ? '6px 16px' : undefined }}>{formatDate(doc.dataUpload)}</td>}
              <td style={{ padding: isCompact ? '6px 16px' : undefined, fontSize: isCompact ? '0.8rem' : undefined }}>{doc.tamanho}</td>
              {!isCompact && (
                <td style={{ padding: isCompact ? '6px 16px' : undefined }}>
                  {(() => {
                    const badge = getValidadeBadge(doc.dataValidade);
                    if (!badge) return <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>—</span>;
                    return (
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </td>
              )}
              <td style={{ textAlign: 'right', padding: isCompact ? '6px 16px' : undefined }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button
                    className="btn-back"
                    style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', gap: '4px', background: 'var(--color-gold-gradient)', color: '#fff', border: 'none' }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onPreview(doc);
                    }}
                  >
                    <Eye size={12} /> {isCompact ? '' : 'Abrir'}
                  </button>
                  {onRename && (
                    <button
                      className="btn-action-responsavel"
                      title="Renomear"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRename(doc.id, doc.nome);
                      }}
                      style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      className="btn-action-responsavel"
                      title="Excluir"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(doc.id);
                      }}
                      style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
