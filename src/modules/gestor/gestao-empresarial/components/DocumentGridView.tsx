import React, { useMemo } from 'react';
import { Eye, Edit2, Trash2, FileText, Table2, CreditCard, Image as ImageIcon, Presentation, FileCode2 } from 'lucide-react';
import type { CompanyDocument } from '../services/gestaoEmpresarialService';

interface DocumentGridViewProps {
  documents: CompanyDocument[];
  onPreview: (document: CompanyDocument) => void;
  onRename?: (docId: string, currentName: string) => void;
  onMove?: (docId: string) => void;
  onDelete?: (docId: string) => void;
  selectedDocIds?: string[];
  onToggleSelect?: (docId: string) => void;
  showCheckboxes?: boolean;
}

const PdfStaticCover: React.FC = () => (
  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #fff7f7, #ffffff)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
    <div style={{ width: '64px', height: '82px', background: '#ffffff', border: '1px solid #fecaca', borderRadius: '5px', boxShadow: '0 12px 22px rgba(127, 29, 29, 0.13)', display: 'flex', flexDirection: 'column', padding: '8px', gap: '5px', boxSizing: 'border-box' }}>
      <FileText size={18} style={{ color: '#dc2626', marginBottom: '3px' }} />
      <span style={{ height: '4px', borderRadius: '999px', background: '#fecaca', width: '100%' }} />
      <span style={{ height: '4px', borderRadius: '999px', background: '#fee2e2', width: '82%' }} />
      <span style={{ height: '4px', borderRadius: '999px', background: '#fee2e2', width: '92%' }} />
      <span style={{ height: '4px', borderRadius: '999px', background: '#fee2e2', width: '64%' }} />
    </div>
    <span style={{ position: 'absolute', top: '7px', right: '7px', borderRadius: '5px', background: 'rgba(220, 38, 38, 0.94)', color: '#ffffff', padding: '2px 5px', fontSize: '0.58rem', fontWeight: 850 }}>
      PDF
    </span>
  </div>
);

export const DocumentGridView: React.FC<DocumentGridViewProps> = ({
  documents,
  onPreview,
  onRename,
  onMove,
  onDelete,
  selectedDocIds = [],
  onToggleSelect,
  showCheckboxes = false,
}) => {
  const selectedDocIdSet = useMemo(() => new Set(selectedDocIds), [selectedDocIds]);

  const getFileMeta = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return { label: 'PDF', icon: FileText, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
    if (['xlsx', 'xls'].includes(ext)) return { label: 'Planilha', icon: Table2, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
    if (['docx', 'doc'].includes(ext)) return { label: 'Word', icon: FileText, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
    if (['pptx', 'ppt'].includes(ext)) return { label: 'Slides', icon: Presentation, color: '#c2410c', bg: '#fff7ed', border: '#fed7aa' };
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return { label: 'Imagem', icon: ImageIcon, color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
    if (ext === 'xml') return { label: 'XML', icon: FileCode2, color: '#c59235', bg: '#fffbeb', border: '#fde68a' };
    if (ext === 'ofx') return { label: 'OFX', icon: CreditCard, color: '#0f172a', bg: '#f8fafc', border: '#cbd5e1' };
    if (ext === 'txt') return { label: 'Texto', icon: FileCode2, color: '#475569', bg: '#f8fafc', border: '#cbd5e1' };
    return { label: ext ? ext.toUpperCase() : 'Arquivo', icon: FileText, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  };

  const renderThumbnail = (doc: CompanyDocument) => {
    const ext = doc.nome.split('.').pop()?.toLowerCase() || '';
    const meta = getFileMeta(doc.nome);
    const Icon = meta.icon;
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
    const isPdf = ext === 'pdf';

    if (isImage && doc.url) {
      return (
        <img
          src={doc.url}
          alt={doc.nome}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      );
    }

    if (isPdf) {
      return <PdfStaticCover />;
    }

    return (
      <div style={{ width: '100%', height: '100%', background: `linear-gradient(145deg, ${meta.bg}, #ffffff)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: '54px', height: '68px', borderRadius: '8px', background: '#ffffff', border: `1px solid ${meta.border}`, color: meta.color, boxShadow: '0 12px 22px rgba(15, 23, 42, 0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={27} />
        </div>
        <span style={{ position: 'absolute', left: '8px', bottom: '7px', right: '8px', textAlign: 'center', color: meta.color, fontSize: '0.62rem', fontWeight: 850, textTransform: 'uppercase' }}>
          {meta.label}
        </span>
      </div>
    );
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
    if (dias < 0) return { label: `Vencido em ${formatDate(dataValidade)}`, bg: '#fef2f2', color: '#ef4444' };
    if (dias <= 15) return { label: `Vence em ${dias}d (${formatDate(dataValidade)})`, bg: '#fff7ed', color: '#f97316' };
    return { label: `Vál. até ${formatDate(dataValidade)}`, bg: '#f0fdf4', color: '#22c55e' };
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }} className="animate-fade-in">
      {documents.map((doc) => {
        return (
          <div 
            key={doc.id} 
            className="doc-folder-card"
            onDoubleClick={() => onPreview(doc)}
            draggable={Boolean(onMove)}
            onDragStart={(event) => {
              if (!onMove) return;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('application/x-documentos-item', JSON.stringify({ kind: 'document', id: doc.id }));
              event.dataTransfer.setData('text/plain', doc.id);
            }}
            style={{ 
              flexDirection: 'column', 
              alignItems: 'stretch', 
              padding: '16px', 
              gap: '12px',
              position: 'relative'
            }}
          >
            {showCheckboxes && (
              <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}>
                <input
                  type="checkbox"
                  checked={selectedDocIdSet.has(doc.id)}
                  onChange={() => onToggleSelect?.(doc.id)}
                  onDoubleClick={(event) => event.stopPropagation()}
                  style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                />
              </div>
            )}
            <div style={{ 
              height: '104px', 
              backgroundColor: '#f8fafc',
              border: '1px solid #d8e0ea',
              borderRadius: '8px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {renderThumbnail(doc)}
            </div>

            <div>
              <h4
                style={{ 
                  margin: 0, 
                  fontSize: '0.8rem', 
                  fontWeight: 700, 
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={doc.nome}
              >
                {doc.nome}
              </h4>
              <div
                style={{
                  marginTop: '5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  maxWidth: '100%',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: 'var(--color-gold-dark)',
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={`Categoria: ${doc.tipo || 'Sem categoria'}`}
              >
                {doc.tipo || 'Sem categoria'}
              </div>
              {doc.descricao && (
                <p 
                  style={{ 
                    margin: '2px 0 0 0', 
                    fontSize: '0.68rem', 
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={doc.descricao}
                >
                  {doc.descricao}
                </p>
              )}
              {(doc as any).empresaNome && (
                <div style={{ fontSize: '0.68rem', color: 'var(--color-gold-dark)', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  🏢 {(doc as any).empresaNome}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b', marginTop: '4px' }}>
                <span>{doc.tamanho}</span>
                <span>{formatDate(doc.dataUpload)}</span>
              </div>
              {(() => {
                const badge = getValidadeBadge(doc.dataValidade);
                if (!badge) return null;
                return (
                  <div style={{
                    marginTop: '6px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    backgroundColor: badge.bg,
                    color: badge.color,
                    display: 'inline-block'
                  }}>
                    ⏰ {badge.label}
                  </div>
                );
              })()}
            </div>

            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', justifyContent: 'space-between' }}>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onPreview(doc);
                }}
                style={{ flex: 1, padding: '5px', fontSize: '0.72rem', background: 'var(--color-gold-gradient)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <Eye size={12} /> Abrir
              </button>
              {(onRename || onDelete) && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {onRename && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onRename(doc.id, doc.nome);
                      }}
                      style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '5px', borderRadius: '6px', color: '#64748b', cursor: 'pointer', display: 'flex' }}
                      title="Renomear"
                    >
                      <Edit2 size={12} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(doc.id);
                      }}
                      style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '5px', borderRadius: '6px', color: '#ef4444', cursor: 'pointer', display: 'flex' }}
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
