import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, Share2, Sliders } from 'lucide-react';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import {
  documentShareService,
  getShareExpirationMinutes,
  type SharedDocumentLink,
} from '../../documentos/services/documentShareService';
import { CompartilhamentoLinksPanel } from './components/CompartilhamentoLinksPanel';
import { CompartilhamentoPolicyForm } from './components/CompartilhamentoPolicyForm';

const DOCUMENTO_TIPOS_LIMITADOS = [
  { id: 'dre', nome: 'DRE (Demonstração do Resultado do Exercício)' },
  { id: 'balanco', nome: 'Balanço Patrimonial' },
  { id: 'das', nome: 'DAS - Guia Simples Nacional' },
  { id: 'folha', nome: 'Folha de Pagamento e Recibos' },
  { id: 'extratos', nome: 'Extratos Bancários Integrados' },
  { id: 'social', nome: 'Contrato Social e Alterações' }
];

export const CompartilhamentoConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'config' | 'links'>('config');

  // Pre-configuration states
  const [tempoPadrao, setTempoPadrao] = useState('3 horas');
  const [limitarTipos, setLimitarTipos] = useState<string[]>(['dre', 'balanco', 'social']);
  const [exigirSenhaPadrao, setExigirSenhaPadrao] = useState(false);
  const [prazosExigemSenha, setPrazosExigemSenha] = useState<string[]>(['12 horas', '24 horas', '3 dias']);

  // Generated links list state
  const [links, setLinks] = useState<SharedDocumentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMsg(null);

    Promise.all([
      documentShareService.getConfiguracaoCompartilhamento(),
      documentShareService.list(),
    ]).then(([config, nextLinks]) => {
      if (!mounted) return;
      setTempoPadrao(config.tempoPadrao);
      setLimitarTipos(config.limitarTipos);
      setExigirSenhaPadrao(config.exigirSenhaPadrao);
      setPrazosExigemSenha(config.prazosExigemSenha);
      setLinks(nextLinks);
    }).catch((error) => {
      if (!mounted) return;
      setErrorMsg(error instanceof Error
        ? error.message
        : 'Não foi possível carregar as configurações de compartilhamento.');
    }).finally(() => {
      if (!mounted) return;
      setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  const handleToggleTipo = (tipoId: string) => {
    setLimitarTipos(prev =>
      prev.includes(tipoId) ? prev.filter(id => id !== tipoId) : [...prev, tipoId]
    );
  };

  const handleTogglePrazoExigeSenha = (prazo: string) => {
    setPrazosExigemSenha(prev =>
      prev.includes(prazo) ? prev.filter(p => p !== prazo) : [...prev, prazo]
    );
  };

  const handleDeleteLink = (id: string) => {
    setLinkToDelete(id);
  };

  const confirmDeleteLink = async () => {
    if (!linkToDelete) return;
    const targetId = linkToDelete;
    setRevokingId(targetId);
    setErrorMsg(null);
    try {
      await documentShareService.revoke(targetId);
      setLinks((current) => current.map((link) => (
        link.id === targetId || link.shareGroupId === targetId
          ? { ...link, status: 'Expirado' }
          : link
      )));
      setSuccessMsg('Link revogado. Downloads já autorizados podem permanecer válidos por até 5 minutos.');
      setTimeout(() => setSuccessMsg(null), 5000);
      try {
        setLinks(await documentShareService.list());
      } catch (error) {
        setErrorMsg(error instanceof Error
          ? error.message
          : 'O link foi revogado, mas não foi possível atualizar a lista.');
      }
    } catch (error) {
      setErrorMsg(error instanceof Error
        ? error.message
        : 'Não foi possível revogar o compartilhamento. O link continua ativo.');
    } finally {
      setRevokingId(null);
      setLinkToDelete(null);
    }
  };

  const handleSaveConfigs = async () => {
    setErrorMsg(null);
    try {
      await documentShareService.saveConfiguracaoCompartilhamento({
        tempoPadrao,
        tempoPadraoMinutos: getShareExpirationMinutes(tempoPadrao),
        limitarTipos,
        exigirSenhaPadrao,
        prazosExigemSenha,
      });
      setSuccessMsg('Pré-configurações de compartilhamento salvas com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error) {
      setErrorMsg(error instanceof Error
        ? error.message
        : 'Não foi possível salvar as configurações de compartilhamento.');
    }
  };

  return (
    <div className="submodule-content-card animate-fade-in" style={{ opacity: isLoading ? 0.85 : 1 }}>
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '24px 0', color: '#475569' }}>
          <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: '2px' }} />
          <span style={{ fontSize: '0.82rem' }}>Carregando configurações do compartilhamento...</span>
        </div>
      ) : null}

      <div className="submodule-card-header flex-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2>Compartilhamento de Documentos externos</h2>
          <p>Configure regras padrões para expiração automática, senhas temporárias e gerencie links ativos enviados para terceiros.</p>
        </div>
        
        {/* Tab Selector */}
        <div style={{
          display: 'flex',
          backgroundColor: '#f1f5f9',
          padding: '4px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === 'config' ? '#ffffff' : 'transparent',
              color: activeTab === 'config' ? '#1e293b' : '#64748b',
              fontWeight: activeTab === 'config' ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'config' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <Sliders size={14} /> Pré-Configurações
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('links')}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeTab === 'links' ? '#ffffff' : 'transparent',
              color: activeTab === 'links' ? '#1e293b' : '#64748b',
              fontWeight: activeTab === 'links' ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'links' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s'
            }}
          >
            <Share2 size={14} /> Links & Senhas Gerados
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="success-banner" style={{
          margin: '12px 0 20px 0',
          padding: '12px 16px',
          backgroundColor: '#f0fdf4',
          color: '#15803d',
          borderRadius: '8px',
          border: '1px solid #bbf7d0',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" style={{ margin: '12px 0 20px', padding: '12px 16px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} />{errorMsg}</span>
          <button type="button" onClick={() => setReloadKey((current) => current + 1)} style={{ border: '1px solid #fca5a5', background: '#ffffff', color: '#991b1b', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontWeight: 700 }}>Tentar novamente</button>
        </div>
      )}

      {activeTab === 'config' ? (
        <CompartilhamentoPolicyForm
          tempoPadrao={tempoPadrao}
          limitarTipos={limitarTipos}
          exigirSenhaPadrao={exigirSenhaPadrao}
          prazosExigemSenha={prazosExigemSenha}
          documentTypes={DOCUMENTO_TIPOS_LIMITADOS}
          disabled={isLoading}
          onTempoPadraoChange={setTempoPadrao}
          onToggleTipo={handleToggleTipo}
          onToggleSenhaPadrao={() => setExigirSenhaPadrao((current) => !current)}
          onTogglePrazo={handleTogglePrazoExigeSenha}
          onSave={handleSaveConfigs}
        />
      ) : (
        <CompartilhamentoLinksPanel
          links={links}
          revokingId={revokingId}
          onRevoke={handleDeleteLink}
        />
      )}
      <SystemQuickModal
        isOpen={linkToDelete !== null}
        title="Revogar Compartilhamento"
        message="Novas autorizações serão bloqueadas imediatamente. Downloads já autorizados podem permanecer válidos por até 5 minutos. Deseja revogar?"
        confirmLabel="Revogar"
        danger
        onConfirm={confirmDeleteLink}
        onClose={() => setLinkToDelete(null)}
      />
    </div>
  );
};
