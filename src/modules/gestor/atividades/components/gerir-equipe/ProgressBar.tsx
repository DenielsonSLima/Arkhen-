import React from 'react';
import { styles } from './styles';

interface ProgressBarProps {
  value: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value }) => (
  <div style={styles.progressLine}>
    <div
      style={{
        backgroundColor: value === 100 ? '#10b981' : 'var(--color-gold-primary)',
        height: '100%',
        width: `${value}%`,
      }}
    />
  </div>
);
