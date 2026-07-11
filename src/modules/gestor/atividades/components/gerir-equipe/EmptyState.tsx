import React from 'react';
import { styles } from './styles';

interface EmptyStateProps {
  icon: React.ReactNode;
  text: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, text }) => (
  <div className="empty-state-card" style={styles.emptyCard}>
    {icon}
    <p style={{ marginTop: '12px', fontSize: '0.88rem', color: '#64748b', fontWeight: 500 }}>
      {text}
    </p>
  </div>
);
