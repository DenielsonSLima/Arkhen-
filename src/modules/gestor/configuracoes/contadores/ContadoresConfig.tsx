import React from 'react';
import { UserCheck, Star, StarOff } from 'lucide-react';
import { useContadores } from './hooks/useContadores';
import { ContadorForm } from './forms/ContadorForm';

export const ContadoresConfig: React.FC = () => {
  const {
    contadores,
    isLoading,
    isAdding,
    showForm,
    setShowForm,
    nome,
    setNome,
    crc,
    setCrc,
    cpfCnpj,
    setCpfCnpj,
    email,
    setEmail,
    successMsg,
    handleToggleResponsavel,
    handleAdd,
  } = useContadores();

  if (isLoading) {
    return <div className="sub-loading">Carregando lista de contadores...</div>;
  }

  return (
    <div className="submodule-content-card">
      <div className="submodule-card-header flex-header">
        <div>
          <h2>Gestão de Contadores</h2>
          <p>Cadastre os contadores do escritório e defina o responsável pela assinatura de relatórios.</p>
        </div>
        <button className="btn-add-user" onClick={() => setShowForm(true)}>
          <UserCheck size={16} /> Cadastrar Contador
        </button>
      </div>

      {successMsg && <div className="success-banner">{successMsg}</div>}

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <h3>Cadastrar Novo Contador</h3>
            <ContadorForm
              nome={nome}
              setNome={setNome}
              crc={crc}
              setCrc={setCrc}
              cpfCnpj={cpfCnpj}
              setCpfCnpj={setCpfCnpj}
              email={email}
              setEmail={setEmail}
              isAdding={isAdding}
              onSubmit={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* Table of Accountants */}
      <div className="table-responsive">
        <table className="config-table">
          <thead>
            <tr>
              <th>Contador</th>
              <th>Registro CRC</th>
              <th>CPF/CNPJ Assinatura</th>
              <th>E-mail</th>
              <th>Função</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {contadores.map((ct) => (
              <tr key={ct.id}>
                <td>
                  <strong>{ct.nome}</strong>
                </td>
                <td>{ct.crc}</td>
                <td>{ct.cpfCnpj}</td>
                <td>{ct.email}</td>
                <td>
                  {ct.isResponsavel ? (
                    <span className="table-badge badge-green">Responsável Técnico</span>
                  ) : (
                    <span className="table-badge badge-gray">Contador Adjunto</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {ct.isResponsavel ? (
                    <button
                      className="btn-action-responsavel active"
                      disabled
                      title="Este é o responsável técnico ativo"
                    >
                      <Star size={16} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      className="btn-action-responsavel"
                      onClick={() => handleToggleResponsavel(ct.id)}
                      title="Definir como Responsável Técnico"
                    >
                      <StarOff size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
