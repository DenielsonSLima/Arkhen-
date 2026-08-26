export const pageStyle = { display: 'flex', flexDirection: 'column' as const, gap: '18px' };
export const personalContextStyle = {
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(197, 146, 53, 0.28)',
  background: 'rgba(197, 146, 53, 0.08)',
  color: '#78571d',
  fontSize: '0.82rem',
};
export const listStyle = { display: 'flex', flexDirection: 'column' as const, gap: '10px' };
export const taskCardStyle = {
  display: 'grid',
  gridTemplateColumns: '28px 1fr',
  gap: '10px',
  alignItems: 'start',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '12px',
};
export const checkBtnStyle = { border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' };
export const taskMainBtnStyle = { border: 'none', background: 'transparent', textAlign: 'left' as const, cursor: 'pointer', padding: 0 };
export const taskTitleRowStyle = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const, color: '#0f172a' };
export const metaGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
  gap: '4px 12px',
  marginTop: '7px',
  color: '#64748b',
  fontSize: '0.76rem',
};
const chipBaseStyle = { borderRadius: '999px', padding: '2px 7px', fontSize: '0.66rem', fontWeight: 800 };
export const dangerChipStyle = { ...chipBaseStyle, background: '#fee2e2', color: '#b91c1c' };
export const blockChipStyle = { ...chipBaseStyle, background: '#fff7ed', color: '#c2410c' };
export const subToolbarStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap' as const,
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '12px 16px',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
};
export const searchWrapperStyle = {
  position: 'relative' as const,
  flex: '1 1 300px',
  display: 'flex',
  alignItems: 'center',
};
export const searchInputStyle = {
  width: '100%',
  padding: '9px 12px 9px 36px',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  fontSize: '0.84rem',
  color: '#0f172a',
  outline: 'none',
  background: '#ffffff',
};
export const searchIconStyle = {
  position: 'absolute' as const,
  left: '12px',
  pointerEvents: 'none' as const,
};
export const clearSearchBtnStyle = {
  position: 'absolute' as const,
  right: '10px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#94a3b8',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
export const dateNavContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'wrap' as const,
};
export const dateNavBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '34px',
  height: '34px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#475569',
  cursor: 'pointer',
  transition: 'all 0.18s ease',
};
export const dateLabelStyle = {
  fontSize: '0.86rem',
  fontWeight: 700,
  color: '#0f172a',
  minWidth: '180px',
  textAlign: 'center' as const,
};
export const dateInputStyle = {
  padding: '8px 10px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#334155',
  cursor: 'pointer',
  outline: 'none',
  background: '#ffffff',
};
export const todayBtnStyle = {
  padding: '8px 12px',
  border: '1px solid rgba(197, 146, 53, 0.3)',
  borderRadius: '8px',
  background: 'rgba(197, 146, 53, 0.08)',
  color: '#aa7c28',
  fontSize: '0.8rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.18s ease',
};
