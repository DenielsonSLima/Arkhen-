import React from 'react';
import { HardDrive, RefreshCw } from 'lucide-react';

interface StorageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export const StorageHeader: React.FC<StorageHeaderProps> = ({ loading, onRefresh }) => (
  <div className="arm-page-header">
    <div className="arm-page-header-icon">
      <HardDrive size={26} />
    </div>
    <div className="arm-page-header-text">
      <h1>Planos e Contratações</h1>
      <p>
        A assinatura é aplicada somente à empresa logada. O armazenamento abaixo soma os arquivos reais
        salvos no módulo Documentos e bloqueia novos uploads quando o limite do plano é alcançado.
      </p>
    </div>
    <button className="arm-refresh-btn" onClick={onRefresh} disabled={loading}>
      <RefreshCw size={15} /> Atualizar
    </button>
  </div>
);
