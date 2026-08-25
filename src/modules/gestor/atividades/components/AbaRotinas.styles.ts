export const primaryBtnStyle = {
  background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
  border: 'none',
  borderRadius: '6px',
  padding: '10px 16px',
  color: '#ffffff',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  boxShadow: '0 4px 10px rgba(197, 146, 53, 0.15)',
};

export const tabsWrapperStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #e2e8f0',
  flexWrap: 'wrap' as const,
  gap: '12px',
};

export const tabsContainerStyle = {
  display: 'flex',
  gap: '16px',
};

export const tabBtnStyle = {
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  padding: '8px 4px',
  fontSize: '0.82rem',
  cursor: 'pointer',
  color: '#64748b',
  outline: 'none',
  transition: 'all 0.18s ease',
};

export const gridContainerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: '16px',
};

export const rotinaCardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '12px',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.02)',
  justifyContent: 'space-between',
};

export const iconBtnStyle = {
  backgroundColor: '#f1f5f9',
  border: 'none',
  borderRadius: '4px',
  padding: '5px',
  color: 'var(--color-gold-dark)',
  cursor: 'pointer',
  display: 'flex',
};

export const cardMetaStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
  borderTop: '1px solid #f1f5f9',
  borderBottom: '1px solid #f1f5f9',
  padding: '10px 0',
};

export const metaLabelStyle = {
  fontSize: '0.66rem',
  color: '#64748b',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
};

export const metaValStyle = {
  fontSize: '0.78rem',
  color: '#0f172a',
  fontWeight: 700,
};

export const checklistBlockStyle = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '8px 10px',
};

export const checklistListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: '4px 0 0 0',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '4px',
};

export const checklistItemStyle = {
  fontSize: '0.75rem',
  color: '#334155',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
};

export const cardFooterStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '4px',
};

export const badgeStyle = {
  fontSize: '0.65rem',
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: '4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

export const emptyCardStyle = {
  backgroundColor: '#ffffff',
  border: '1px dashed #cbd5e1',
  borderRadius: '8px',
  padding: '40px',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
};

/* Estilos da Gaveta Lateral (Drawer) */
export const drawerOverlayStyle = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  backdropFilter: 'blur(3px)',
  zIndex: 1000,
  display: 'flex',
  justifyContent: 'flex-end',
};

export const drawerContentStyle = {
  width: '100%',
  maxWidth: '460px',
  backgroundColor: '#ffffff',
  height: '100%',
  boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '16px',
  overflowY: 'auto' as const,
};

export const drawerHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid #e2e8f0',
  paddingBottom: '14px',
};

export const closeBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
};

export const formStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '14px',
};

export const fieldStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '5px',
};

export const rowStyle = {
  display: 'flex',
  gap: '12px',
};

export const labelStyle = {
  fontSize: '0.75rem',
  color: 'var(--color-gold-dark)',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

export const inputStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#0f172a',
  fontSize: '0.82rem',
  outline: 'none',
  width: '100%',
};

export const selectStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#0f172a',
  fontSize: '0.82rem',
  outline: 'none',
  width: '100%',
  cursor: 'pointer',
};

export const textareaStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '8px 10px',
  color: '#0f172a',
  fontSize: '0.82rem',
  outline: 'none',
  resize: 'vertical' as const,
  width: '100%',
};

export const drawerActionsStyle = {
  display: 'flex',
  gap: '12px',
  marginTop: '12px',
};

export const submitBtnStyle = {
  background: 'linear-gradient(135deg, #c59235 0%, #aa7c28 100%)',
  border: 'none',
  borderRadius: '6px',
  padding: '10px 16px',
  color: '#ffffff',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  flex: 1,
  boxShadow: '0 2px 6px rgba(197, 146, 53, 0.2)',
};

export const cancelBtnStyle = {
  backgroundColor: 'transparent',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  padding: '10px 16px',
  color: '#64748b',
  fontSize: '0.82rem',
  fontWeight: 500,
  cursor: 'pointer',
};
