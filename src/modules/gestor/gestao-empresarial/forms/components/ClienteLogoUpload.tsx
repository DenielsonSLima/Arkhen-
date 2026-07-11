import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { uploadImageAsset } from '../../../shared/uploadImageAsset';

interface ClienteLogoUploadProps {
  logo: string;
  onLogoChange: (logo: string) => void;
}

export const ClienteLogoUpload: React.FC<ClienteLogoUploadProps> = ({ logo, onLogoChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogoChange = async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const publicUrl = await uploadImageAsset(file, 'cliente-logos', `cliente-${Date.now()}`);
      onLogoChange(publicUrl);
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro ao enviar logo.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="logo-upload-card">
      <div className="logo-upload-zone" onClick={() => !isUploading && fileInputRef.current?.click()}>
        {logo ? (
          <img src={logo} alt="Logo Preview" className="logo-upload-preview" />
        ) : (
          <div className="logo-upload-placeholder">
            <ImagePlus size={28} />
            <span>Logo do Cliente</span>
            <small>{isUploading ? 'Enviando...' : 'Clique para enviar PNG/JPG'}</small>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(event) => void handleLogoChange(event.target.files?.[0])}
        />
      </div>
      {errorMsg && <small style={{ color: '#b91c1c', fontWeight: 600 }}>{errorMsg}</small>}
      {logo && (
        <button type="button" className="logo-remove-btn" onClick={() => onLogoChange('')}>
          <Trash2 size={13} /> Remover Logo
        </button>
      )}
    </div>
  );
};
