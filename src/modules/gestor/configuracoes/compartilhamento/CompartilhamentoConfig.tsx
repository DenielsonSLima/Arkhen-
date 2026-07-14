import React, { useState, useEffect } from 'react';
import { Share2, Clock, ShieldAlert, Key, Clipboard, Check, Search, User, FileText, Trash2, Sliders, ToggleLeft, ToggleRight } from 'lucide-react';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import { copyToClipboard } from '../../../../lib/clipboard';
import {
  documentShareService,
  getShareExpirationMinutes,
  type SharedDocumentLink,
  SHARE_EXPIRATION_OPTIONS,
} from '../../documentos/services/documentShareService';
const TEMPOS_EXPIRACAO = SHARE_EXPIRATION_OPTIONS;

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

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Ativo' | 'Expirado'>('Todos');
  const [filterUser, setFilterUser] = useState('Todos');
  const [filterDate, setFilterDate] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleSenhaId, setVisibleSenhaId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

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
    }).finally(() => {
      if (!mounted) return;
      setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

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

  const handleCopyLink = async (id: string, url: string) => {
    await copyToClipboard(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteLink = (id: string) => {
    setLinkToDelete(id);
  };

  const confirmDeleteLink = async () => {
    if (!linkToDelete) return;
    const success = await documentShareService.revoke(linkToDelete);
    const latest = await documentShareService.list();
    setLinks(latest);
    setLinkToDelete(null);
    setSuccessMsg(success ? 'Link de compartilhamento revogado com sucesso!' : 'Falha ao revogar link no servidor.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveConfigs = async () => {
    await documentShareService.saveConfiguracaoCompartilhamento({
      tempoPadrao: tempoPadrao,
      tempoPadraoMinutos: getShareExpirationMinutes(tempoPadrao),
      limitarTipos,
      exigirSenhaPadrao,
      prazosExigemSenha,
    });
    setSuccessMsg('Pré-configurações de compartilhamento salvas com sucesso!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Extract unique users who generated links for filters
  const usersList = ['Todos', ...Array.from(new Set(links.map(l => l.geradoPor)))];

  // Filtering Logic
  const filteredLinks = links.filter(link => {
    const matchesSearch =
      link.documento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.geradoPor.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'Todos' || link.status === filterStatus;
    const matchesUser = filterUser === 'Todos' || link.geradoPor === filterUser;
    
    let matchesDate = true;
    if (filterDate) {
      // Simple date startsWith comparison on "DD/MM/YYYY" formatted string
      const [year, month, day] = filterDate.split('-');
      const formattedDateFilter = `${day}/${month}/${year}`;
      matchesDate = link.dataGeracao.includes(formattedDateFilter);
    }

    return matchesSearch && matchesStatus && matchesUser && matchesDate;
  });

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

      {activeTab === 'config' ? (
        /* =================== TAB 1: PRE-CONFIGS =================== */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginTop: '10px' }}>
          
          {/* Left Column: Expiry & Document limit configuration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Session 1: Expiry standard and time limits */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Clock size={18} style={{ color: 'var(--color-gold-primary)' }} />
                Tempo de Expiração de Links
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
                Defina o tempo padrão inicial no qual um documento compartilhado ficará ativo para download ou leitura antes de expirar.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Tempo de expiração padrão</label>
                <select
                  value={tempoPadrao}
                  onChange={(e) => setTempoPadrao(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    backgroundColor: '#ffffff', // Rule INPUT_LEGIBILITY: white background
                    color: '#111827', // Rule INPUT_LEGIBILITY: dark text
                    width: '100%',
                    cursor: 'pointer'
                  }}
                >
                  {TEMPOS_EXPIRACAO.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Session 2: Documents limitation defaults */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <ShieldAlert size={18} style={{ color: 'var(--color-gold-primary)' }} />
                Documentos com Limitação Recomendada
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
                Tipos de documentos financeiros ou fiscais que, ao serem compartilhados externamente, **sempre terão sugestão padrão de proteção** por expiração ou senha.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                {DOCUMENTO_TIPOS_LIMITADOS.map((tipo) => {
                  const isChecked = limitarTipos.includes(tipo.id);
                  return (
                    <div 
                      key={tipo.id}
                      onClick={() => handleToggleTipo(tipo.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: isChecked ? '1px solid #fde68a' : '1px solid #e2e8f0',
                        backgroundColor: isChecked ? '#fffdf5' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Controlled via parent row click
                        style={{ accentColor: 'var(--color-gold-primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.82rem', fontWeight: isChecked ? 600 : 500, color: isChecked ? '#1e293b' : '#475569' }}>
                        {tipo.nome}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Password and trigger options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Session 3: Temporary Password Defaults */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Key size={18} style={{ color: 'var(--color-gold-primary)' }} />
                    Senhas Temporárias Automáticas
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                    Se ativado, todo link gerado gerará automaticamente uma chave única. O receptor precisará digitar a senha para realizar o download.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setExigirSenhaPadrao(!exigirSenhaPadrao)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {exigirSenhaPadrao ? (
                    <ToggleRight size={40} style={{ color: 'var(--color-gold-primary)' }} />
                  ) : (
                    <ToggleLeft size={40} style={{ color: '#cbd5e1' }} />
                  )}
                </button>
              </div>

              <div style={{
                marginTop: '12px',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '16px'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Exigir senha automática para prazos maiores:
                </span>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 12px 0' }}>
                  Mesmo se as senhas gerais estiverem desativadas, os seguintes prazos de validade **exigirão obrigatoriamente** uma senha do cliente para acesso.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {TEMPOS_EXPIRACAO.map((prazo) => {
                    const isChecked = prazosExigemSenha.includes(prazo);
                    return (
                      <div 
                        key={prazo}
                        onClick={() => handleTogglePrazoExigeSenha(prazo)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: isChecked ? '1px solid #cbd5e1' : '1px solid #f1f5f9',
                          backgroundColor: isChecked ? '#f8fafc' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.1s'
                        }}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled via click
                          style={{ accentColor: 'var(--color-gold-primary)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.78rem', fontWeight: isChecked ? 600 : 500, color: isChecked ? '#1e293b' : '#64748b' }}>
                          {prazo}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Action panel button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                onClick={handleSaveConfigs}
                disabled={isLoading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--color-gold-primary)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                }}
              >
                Salvar Configurações
              </button>
            </div>

          </div>

        </div>
      ) : (
        /* =================== TAB 2: LINKS & PASSWORDS LOGS =================== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Advanced Search & Filtering Bar */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            backgroundColor: '#f8fafc',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ flex: '2', minWidth: '240px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input 
                type="text" 
                placeholder="Buscar por documento ou empresa..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '10px 12px 10px 36px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  width: '100%',
                  backgroundColor: '#ffffff', // Rule INPUT_LEGIBILITY: white background
                  color: '#111827', // Rule INPUT_LEGIBILITY: dark text
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Status Filter */}
            <div style={{ flex: '1', minWidth: '120px' }}>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  cursor: 'pointer'
                }}
              >
                <option value="Todos">Todos os Status</option>
                <option value="Ativo">Ativo</option>
                <option value="Expirado">Expirado</option>
              </select>
            </div>

            {/* Created By Filter */}
            <div style={{ flex: '1', minWidth: '140px' }}>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  cursor: 'pointer'
                }}
              >
                <option value="Todos">Criado por: Todos</option>
                {usersList.filter(u => u !== 'Todos').map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Creation Date Filter */}
            <div style={{ flex: '1', minWidth: '140px' }}>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  width: '100%',
                  backgroundColor: '#ffffff',
                  color: '#111827',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Clear filters buttons */}
            {(searchTerm || filterStatus !== 'Todos' || filterUser !== 'Todos' || filterDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('Todos');
                  setFilterUser('Todos');
                  setFilterDate('');
                }}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Limpar
              </button>
            )}
          </div>

          {/* Table List of Shared Links */}
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Lista de Compartilhamentos ({filteredLinks.length})
          </div>

          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Documento / Empresa</th>
                  <th style={{ width: '150px' }}>Criado Por</th>
                  <th style={{ width: '160px' }}>Data Geração</th>
                  <th style={{ width: '160px' }}>Expiração</th>
                  <th>Chave de Acesso</th>
                  <th>Link</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((link) => {
                    const isCopied = copiedId === link.id;
                    const isSenhaVisible = visibleSenhaId === link.id;

                    return (
                      <tr key={link.id} className="hover:bg-slate-50/50" style={{ transition: 'all 0.1s' }}>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            backgroundColor: link.status === 'Ativo' ? '#f0fdf4' : '#f1f5f9',
                            color: link.status === 'Ativo' ? '#166534' : '#64748b',
                            border: link.status === 'Ativo' ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
                          }}>
                            {link.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FileText size={15} style={{ color: 'var(--color-gold-primary)' }} />
                              {link.documento}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {link.empresa}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#475569', fontWeight: 500 }}>
                            <User size={13} style={{ color: '#94a3b8' }} />
                            {link.geradoPor}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          {link.dataGeracao}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: link.status === 'Ativo' ? '#b45309' : '#94a3b8', fontWeight: link.status === 'Ativo' ? 600 : 400 }}>
                            <Clock size={13} />
                            {link.dataExpiracao}
                          </span>
                        </td>
                        <td>
                          {link.senha ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Key size={13} style={{ color: '#b45309' }} />
                              <span 
                                onClick={() => setVisibleSenhaId(isSenhaVisible ? null : link.id)}
                                style={{
                                  fontSize: '0.75rem',
                                  fontFamily: 'monospace',
                                  backgroundColor: '#fffbeb',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  userSelect: 'none'
                                }}
                                title="Clique para ocultar/revelar senha"
                              >
                                {isSenhaVisible ? link.senha : '••••••••'}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                              Livre (Sem senha)
                            </span>
                          )}
                        </td>
                        <td>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0, 1fr) auto',
                              alignItems: 'center',
                              gap: '6px',
                              color: '#334155',
                              fontSize: '0.72rem',
                            }}
                            title={link.link}
                          >
                            <span
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: '#475569',
                              }}
                            >
                              {link.link}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(link.id, link.link)}
                              style={{
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: copiedId === link.id ? '#166534' : '#475569',
                                borderRadius: '4px',
                                padding: '5px 6px',
                                fontSize: '0.68rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap',
                              }}
                              title="Copiar URL"
                            >
                              {copiedId === link.id ? <Check size={12} /> : <Clipboard size={12} />}
                              Copiar
                            </button>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(link.id, link.link)}
                              disabled={link.status === 'Expirado'}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: isCopied ? '#f0fdf4' : '#ffffff',
                                color: isCopied ? '#166534' : '#475569',
                                cursor: link.status === 'Expirado' ? 'not-allowed' : 'pointer',
                                opacity: link.status === 'Expirado' ? 0.5 : 1,
                                transition: 'all 0.1s'
                              }}
                              title="Copiar URL de compartilhamento"
                            >
                              {isCopied ? <Check size={12} /> : <Clipboard size={12} />}
                              {isCopied ? 'Copiado!' : 'Copiar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLink(link.id)}
                              style={{
                                padding: '6px',
                                borderRadius: '4px',
                                border: '1px solid #fca5a5',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Revogar link"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '0.85rem' }}>
                      Nenhum link de compartilhamento encontrado para os critérios informados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}
      <SystemQuickModal
        isOpen={linkToDelete !== null}
        title="Revogar Compartilhamento"
        message="Deseja realmente revogar este link? Quem tentar acessá-lo receberá uma mensagem de expirado."
        confirmLabel="Revogar"
        danger
        onConfirm={confirmDeleteLink}
        onClose={() => setLinkToDelete(null)}
      />
    </div>
  );
};
