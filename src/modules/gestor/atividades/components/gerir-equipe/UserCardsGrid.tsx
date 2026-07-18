import React from 'react';
import type { UserStats } from './types';
import { styles } from './styles';

interface UserCardsGridProps {
  onSelectUser: (id: string) => void;
  users: UserStats[];
}

export const UserCardsGrid: React.FC<UserCardsGridProps> = ({ onSelectUser, users }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div style={styles.grid}>
      {users.map((user) => (
        <div key={user.id} style={styles.userCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={styles.avatar}>{user.avatar}</div>
            <div>
              <strong style={{ color: '#0f172a', fontSize: '0.95rem', display: 'block' }}>{user.nome}</strong>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{user.perfil}</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '10px 0',
            marginBottom: '16px',
          }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: user.progresso === 100 ? '#10b981' : 'var(--color-gold-dark)' }}>
                {user.progresso}%
              </span>
              <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Andamento</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', borderLeft: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: user.atrasadas > 0 ? '#ef4444' : '#64748b' }}>
                {user.atrasadas}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase' }}>Atrasadas</span>
            </div>
          </div>

          <button onClick={() => onSelectUser(user.id)} style={styles.manageBtn} type="button">
            Fiscalizar Atividades
          </button>
        </div>
      ))}
    </div>
  </div>
);
