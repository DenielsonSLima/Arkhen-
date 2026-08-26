import React, { useRef, useState } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';
import {
  getAvatarSourceDescription,
  getProfileInitials,
  type AvatarSource,
} from '../../../../lib/profileAvatar';
import { SystemQuickModal } from '../../components/SystemQuickModal';

interface ProfileAvatarCardProps {
  nome: string;
  perfil: string;
  avatar: string;
  avatarSource: AvatarSource;
  isBusy: boolean;
  onFileSelected: (file?: File) => void;
  onRemove: () => void | Promise<void>;
}

export const ProfileAvatarCard: React.FC<ProfileAvatarCardProps> = ({
  nome,
  perfil,
  avatar,
  avatarSource,
  isBusy,
  onFileSelected,
  onRemove,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const selectFile = () => fileInputRef.current?.click();

  return (
    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
      <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', margin: '0 0 16px 0', letterSpacing: '0.04em', textAlign: 'left' }}>
        Foto de Perfil
      </h4>
      <button
        type="button"
        onClick={selectFile}
        style={{ position: 'relative', width: 110, height: 110, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--color-gold-primary)', padding: 0, cursor: 'pointer', background: '#f8fafc' }}
        title="Enviar nova foto"
        disabled={isBusy}
      >
        {avatar ? (
          <img src={avatar} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
        ) : (
          <span style={{ display: 'grid', width: '100%', height: '100%', placeItems: 'center', color: '#475569', fontSize: '1.75rem', fontWeight: 800 }}>
            {getProfileInitials(nome)}
          </span>
        )}
        <span style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.48)', color: '#fff', display: 'grid', placeItems: 'center', opacity: isBusy ? 1 : 0 }}>
          {isBusy ? <Upload size={20} /> : <Camera size={20} />}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => {
          onFileSelected(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: '14px 0 2px 0' }}>{nome}</p>
      <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{perfil}</p>
      <p style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.45, margin: '10px 0 0' }}>
        {getAvatarSourceDescription(avatarSource, Boolean(avatar))}
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
        <button type="button" className="btn-save-settings" onClick={selectFile} disabled={isBusy}>
          <Upload size={14} /> {isBusy ? 'Atualizando...' : avatar ? 'Substituir foto' : 'Enviar nova foto'}
        </button>
        {avatar && (
          <button
            type="button"
            className="btn-save-settings"
            onClick={() => setShowRemoveConfirmation(true)}
            disabled={isBusy}
            style={{ background: '#fff', color: '#b91c1c', borderColor: '#fecaca' }}
          >
            <Trash2 size={14} /> Usar iniciais
          </button>
        )}
      </div>

      <SystemQuickModal
        isOpen={showRemoveConfirmation}
        title="Remover foto de perfil?"
        message="A foto será removida da sua conta e o sistema passará a exibir suas iniciais. O vínculo com o Google não será alterado."
        confirmLabel="Remover foto"
        onConfirm={() => { void onRemove(); }}
        onClose={() => setShowRemoveConfirmation(false)}
        danger
      />
    </div>
  );
};
