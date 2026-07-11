import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, 
  FileText, 
  Handshake, 
  Landmark, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Info
} from 'lucide-react';
import {
  catalogosService,
  type CatalogoDefaultItem,
  type CatalogoItem,
  type CatalogoTipo,
} from '../services/catalogosService';
import './ParametrizacaoPlaceholder.css';

type ParametrizacaoKind = 'tipos-empresa' | 'natureza-juridica' | 'tipos-parceiros' | 'tipos-documentos';

interface ParametrizacaoItem {
  id: string;
  nome: string;
  descricao: string;
  status: 'Ativo' | 'Inativo' | 'Padrão';
  sistema?: boolean;
}

interface ParametrizacaoKindConfig {
  title: string;
  description: string;
  icon: React.ReactNode;
  defaultItems: ParametrizacaoItem[];
  integrationNote: string;
}

const PARAMETRIZACAO_CONFIGS: Record<ParametrizacaoKind, ParametrizacaoKindConfig> = {
  'tipos-empresa': {
    title: 'Tipos de Empresa',
    description: 'Classifique clientes por porte, enquadramento operacional e modelo de atendimento do escritório.',
    icon: <Building2 size={22} />,
    integrationNote: 'Vinculado diretamente ao cadastro de Clientes na aba de dados fiscais/societários para segmentar as rotinas do escritório.',
    defaultItems: [
      { id: 'te-1', nome: 'Pessoa Física', descricao: 'Cliente PF/autônomo sem CNPJ, usado para atendimentos e rotinas pessoais.', status: 'Padrão' },
      { id: 'te-2', nome: 'MEI', descricao: 'Microempreendedor individual com rotinas simplificadas.', status: 'Padrão' },
      { id: 'te-3', nome: 'Microempresa', descricao: 'Empresa cliente com faturamento e obrigações de pequeno porte.', status: 'Ativo' },
      { id: 'te-4', nome: 'Empresa de Pequeno Porte', descricao: 'Cliente com maior volume fiscal, contábil e trabalhista.', status: 'Ativo' },
      { id: 'te-5', nome: 'Isenta / Imune', descricao: 'Entidade ou operação com tratamento tributário diferenciado.', status: 'Ativo' },
      { id: 'te-6', nome: 'Holding / Patrimonial', descricao: 'Empresa com acompanhamento societário e documental específico.', status: 'Ativo' },
    ],
  },
  'natureza-juridica': {
    title: 'Natureza Jurídica',
    description: 'Organize as naturezas jurídicas usadas no cadastro e nas rotinas fiscais dos clientes.',
    icon: <Landmark size={22} />,
    integrationNote: 'Alimenta o cadastro societário de Clientes e impacta as simulações tributárias de constituição de novas empresas.',
    defaultItems: [
      { id: 'nj-1', nome: 'Empresário Individual', descricao: 'Pessoa física titular de atividade empresarial.', status: 'Ativo' },
      { id: 'nj-2', nome: 'Sociedade Limitada', descricao: 'Empresa formada por sócios com quotas de participação.', status: 'Padrão' },
      { id: 'nj-3', nome: 'Sociedade Limitada Unipessoal', descricao: 'Modelo societário com um único titular.', status: 'Ativo' },
      { id: 'nj-4', nome: 'Associação Privada', descricao: 'Entidade sem fins lucrativos com obrigações próprias.', status: 'Ativo' },
    ],
  },
  'tipos-parceiros': {
    title: 'Tipos de Parceiros',
    description: 'Padronize categorias de parceiros, canais comerciais e relações de indicação.',
    icon: <Handshake size={22} />,
    integrationNote: 'Utilizado no CRM e no controle financeiro de faturamento para calcular comissões e rastrear origem de leads.',
    defaultItems: [
      { id: 'tp-1', nome: 'Cliente Contábil', descricao: 'Empresa atendida diretamente pelo escritório.', status: 'Padrão' },
      { id: 'tp-2', nome: 'Parceiro Comercial', descricao: 'Origem de indicações e oportunidades comerciais.', status: 'Ativo' },
      { id: 'tp-3', nome: 'Fornecedor', descricao: 'Prestador ou fornecedor vinculado às rotinas internas.', status: 'Ativo' },
      { id: 'tp-4', nome: 'Correspondente', descricao: 'Parceiro operacional para demandas locais.', status: 'Ativo' },
    ],
  },
  'tipos-documentos': {
    title: 'Tipos de Documentos',
    description: 'Padronize categorias documentais usadas em empresas, contratos, procurações, certidões e protocolos.',
    icon: <FileText size={22} />,
    integrationNote: 'Fornece a tipologia de anexos para o módulo de Protocolos e para a pasta de Documentos Digitais por empresa.',
    defaultItems: [
      { id: 'td-1', nome: 'Contrato', descricao: 'Instrumentos contratuais do escritório e dos clientes.', status: 'Padrão' },
      { id: 'td-2', nome: 'Procuração', descricao: 'Procurações eletrônicas, físicas e autorizações de representação.', status: 'Ativo' },
      { id: 'td-3', nome: 'Certidão', descricao: 'Certidões negativas, positivas e documentos de regularidade.', status: 'Ativo' },
      { id: 'td-4', nome: 'Guia / Comprovante', descricao: 'Guias fiscais, trabalhistas e comprovantes de pagamento.', status: 'Ativo' },
    ],
  },
};

const KIND_TO_TIPO: Record<ParametrizacaoKind, CatalogoTipo> = {
  'tipos-empresa': 'tipos_empresa',
  'natureza-juridica': 'naturezas_juridicas',
  'tipos-parceiros': 'tipos_parceiros',
  'tipos-documentos': 'tipos_documentos',
};

const toDefaultItems = (items: ParametrizacaoItem[]): CatalogoDefaultItem[] => (
  items.map((item, index) => ({
    codigo: item.id,
    nome: item.nome,
    descricao: item.descricao,
    sistema: item.status === 'Padrão',
    ativo: item.status !== 'Inativo',
    ordem: (index + 1) * 10,
  }))
);

const fromCatalogo = (item: CatalogoItem): ParametrizacaoItem => ({
  id: item.id,
  nome: item.nome,
  descricao: item.descricao,
  status: item.ativo ? (item.sistema ? 'Padrão' : 'Ativo') : 'Inativo',
  sistema: item.sistema,
});

interface ParametrizacaoPlaceholderPageProps {
  kind: ParametrizacaoKind;
}

export const ParametrizacaoPlaceholderPage: React.FC<ParametrizacaoPlaceholderPageProps> = ({ kind }) => {
  const config = PARAMETRIZACAO_CONFIGS[kind];
  const tipo = KIND_TO_TIPO[kind];
  const queryClient = useQueryClient();
  const queryKey = ['parametrizacao', 'catalogos', tipo] as const;
  const catalogosQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const rows = await catalogosService.list(tipo, toDefaultItems(config.defaultItems));
      return rows.map(fromCatalogo);
    },
    staleTime: 5 * 60 * 1000,
  });

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ParametrizacaoItem | null>(null);

  // Form State
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [status, setStatus] = useState<'Ativo' | 'Inativo' | 'Padrão'>('Ativo');
  const [error, setError] = useState('');
  const items = catalogosQuery.data || [];
  const saveMutation = useMutation({
    mutationFn: () => catalogosService.save({
      id: editingItem?.id,
      tipo,
      nome,
      descricao,
      ativo: status !== 'Inativo',
      sistema: status === 'Padrão' || Boolean(editingItem?.sistema),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) => catalogosService.setAtivo(id, ativo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Filter items
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.nome.toLowerCase().includes(term) ||
        item.descricao.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  // Open modals
  const handleOpenAdd = () => {
    setEditingItem(null);
    setNome('');
    setDescricao('');
    setStatus('Ativo');
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: ParametrizacaoItem) => {
    setEditingItem(item);
    setNome(item.nome);
    setDescricao(item.descricao);
    setStatus(item.status);
    setError('');
    setShowModal(true);
  };

  // CRUD actions
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('O nome é de preenchimento obrigatório.');
      return;
    }

    try {
      await saveMutation.mutateAsync();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar parametro no Supabase.');
    }
  };

  const handleToggleStatus = async (item: ParametrizacaoItem) => {
    try {
      await toggleMutation.mutateAsync({ id: item.id, ativo: item.status === 'Inativo' });
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar status no Supabase.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await toggleMutation.mutateAsync({ id, ativo: false });
    } catch (err: any) {
      setError(err.message || 'Erro ao inativar parametro no Supabase.');
    }
  };

  return (
    <div className="parametrizacao-page animate-fade-in">
      <div className="submodule-content-card">
        {/* Header */}
        <div className="submodule-card-header flex-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
          <div className="parametrizacao-title">
            <span className="parametrizacao-title-icon">{config.icon}</span>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' }}>{config.title}</h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{config.description}</p>
            </div>
          </div>
          <button type="button" className="btn-add-user" onClick={handleOpenAdd}>
            <Plus size={16} /> Novo Registro
          </button>
        </div>

        {/* Info Box detailing integration with Simulators, Faturamento, Protocolos or Clientes */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginTop: '16px',
          fontSize: '0.825rem',
          color: '#475569'
        }}>
          <Info size={18} style={{ color: 'var(--color-gold-primary)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: '#0f172a' }}>Integração do Sistema: </strong>
            {config.integrationNote}
          </div>
        </div>

        {/* Toolbar */}
        <div className="parametrizacao-toolbar" style={{ marginTop: '20px', marginBottom: '16px' }}>
          <Search size={16} />
          <input 
            type="text" 
            placeholder={`Buscar em ${config.title.toLowerCase()}...`} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table List */}
        <div className="table-responsive">
          <table className="config-table">
            <thead>
              <tr>
                <th style={{ width: '220px' }}>Nome</th>
                <th>Descrição</th>
                <th style={{ width: '130px' }}>Status</th>
                <th style={{ textAlign: 'right', width: '150px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {catalogosQuery.isLoading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    Carregando parametros no Supabase...
                  </td>
                </tr>
              ) : catalogosQuery.error ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#b91c1c', padding: '32px' }}>
                    Erro ao carregar parametros.
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isAtivo = item.status === 'Ativo' || item.status === 'Padrão';
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.nome}</strong></td>
                      <td style={{ color: '#475569' }}>{item.descricao}</td>
                      <td>
                        <span className={`status-badge-clear ${isAtivo ? 'active' : 'inactive'}`}>
                          <span className="status-dot"></span>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn-action-small"
                            onClick={() => handleToggleStatus(item)}
                            title={isAtivo ? 'Desativar parâmetro' : 'Ativar parâmetro'}
                          >
                            {isAtivo ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                          </button>
                          <button
                            type="button"
                            className="btn-action-small"
                            onClick={() => handleOpenEdit(item)}
                            title="Editar registro"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-action-small btn-delete"
                            onClick={() => handleDelete(item.id)}
                            title="Inativar registro"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="modal-overlay-custom" style={{ display: 'flex', alignItems: 'center', padding: '20px' }}>
          <form className="cliente-form-container" onSubmit={handleSave} style={{ maxWidth: '480px' }}>
            <div className="cliente-form-header">
              <h2>{editingItem ? 'Editar Registro' : 'Novo Registro'}</h2>
              <p>Gerencie as configurações de {config.title.toLowerCase()}.</p>
            </div>

            {error && (
              <div className="form-alert-banner error">
                <span>{error}</span>
              </div>
            )}

            <div className="cliente-form-main-fields" style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
              {/* INPUT_LEGIBILITY rule: light background, dark text font */}
              <div className="input-container">
                <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569' }}>Nome do Parâmetro *</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="Ex: Novo enquadramento"
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#111827',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    width: '100%',
                    fontSize: '0.875rem'
                  }}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className="input-container">
                <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569' }}>Descrição detalhada</label>
                <textarea
                  className="input-style"
                  placeholder="Explique onde este parâmetro é utilizado..."
                  rows={3}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#111827',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    width: '100%',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                />
              </div>

              <div className="input-container">
                <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569' }}>Status</label>
                <select
                  className="input-style"
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#111827',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    width: '100%',
                    fontSize: '0.875rem'
                  }}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Ativo' | 'Inativo' | 'Padrão')}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Padrão">Padrão</option>
                </select>
              </div>
            </div>

            <div className="form-footer-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn-cancel" 
                onClick={() => setShowModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn-submit"
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--color-gold-primary, #b45309)',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Salvar Parâmetro
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
