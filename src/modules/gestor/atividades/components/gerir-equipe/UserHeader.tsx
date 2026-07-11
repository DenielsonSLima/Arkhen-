import React from 'react';
import { CalendarRange, ChevronLeft, Plus } from 'lucide-react';
import { AVATARES_USUARIOS, PERFIS_USUARIOS } from './config';
import { styles } from './styles';

interface UserHeaderProps {
  onBack: () => void;
  onNovaAtividade: () => void;
  onVincularRotina: () => void;
  selectedUser: string;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  onBack,
  onNovaAtividade,
  onVincularRotina,
  selectedUser,
}) => (
  <>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <button onClick={onBack} style={styles.backBtn} type="button">
        <ChevronLeft size={16} />
        Voltar para Colaboradores
      </button>
    </div>

    <div style={styles.userHeader}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={styles.avatarBig}>{AVATARES_USUARIOS[selectedUser] || 'U'}</div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>Gestão de Atividades - {selectedUser}</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>{PERFIS_USUARIOS[selectedUser] || 'Colaborador'}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onVincularRotina} style={styles.actionBtn} type="button">
          <CalendarRange size={15} /> Vincular Rotina
        </button>
        <button onClick={onNovaAtividade} style={styles.primaryBtn} type="button">
          <Plus size={15} /> Nova Atividade
        </button>
      </div>
    </div>
  </>
);
