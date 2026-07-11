import React from 'react';
import { useEmpresa } from './hooks/useEmpresa';
import { EmpresaForm } from './forms/EmpresaForm';

export const EmpresaConfig: React.FC = () => {
  const {
    dados,
    isLoading,
    isSaving,
    isSearchingCnpj,
    successMsg,
    errorMsg,
    handleInputChange,
    handleLookupCnpj,
    handleLogoUpload,
    handleSave,
  } = useEmpresa();

  if (isLoading || !dados) {
    return <div className="sub-loading">Carregando dados da empresa...</div>;
  }

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header">
        <h2>Dados da Empresa</h2>
        <p>Gerencie as informações corporativas e fiscais da sua empresa.</p>
      </div>

      {successMsg && <div className="success-banner">{successMsg}</div>}
      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <EmpresaForm
        dados={dados}
        isSaving={isSaving}
        isSearchingCnpj={isSearchingCnpj}
        onInputChange={handleInputChange}
        onLookupCnpj={handleLookupCnpj}
        onLogoUpload={handleLogoUpload}
        onSubmit={handleSave}
      />
    </div>
  );
};
