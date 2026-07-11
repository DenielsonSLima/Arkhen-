import React, { useEffect, useMemo, useState } from 'react';
import { FileCode2, Save } from 'lucide-react';
import { useSaveXmlModelosMutation, useXmlModelosQuery } from './queries/useXmlModelosQueries';
import { XML_MODELO_LABELS } from './services/xmlModelosService';
import type { XmlModelo, XmlModeloEstado, XmlModeloTipo } from './types';
import './VisualizadoresXmlConfig.css';

const tipos: XmlModeloTipo[] = ['nfse', 'nfce', 'nfe', 'cte', 'mdfe'];
const estados: { id: XmlModeloEstado; label: string }[] = [
  { id: 'autorizado', label: 'Autorizado' },
  { id: 'cancelado', label: 'Cancelado' },
];

export const VisualizadoresXmlConfig: React.FC = () => {
  const { data = [], isLoading } = useXmlModelosQuery();
  const saveMutation = useSaveXmlModelosMutation();
  const [modelos, setModelos] = useState<XmlModelo[]>([]);
  const [activeTipo, setActiveTipo] = useState<XmlModeloTipo>('nfse');
  const [activeEstado, setActiveEstado] = useState<XmlModeloEstado>('autorizado');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setModelos(data);
  }, [data]);

  const activeModelo = useMemo(() => (
    modelos.find((item) => item.tipo === activeTipo && item.estado === activeEstado)
  ), [activeEstado, activeTipo, modelos]);

  const updateModelo = (changes: Partial<XmlModelo>) => {
    setModelos((current) => current.map((item) => (
      item.tipo === activeTipo && item.estado === activeEstado ? { ...item, ...changes } : item
    )));
  };

  const handleSave = async () => {
    await saveMutation.mutateAsync(modelos);
    setNotice('Modelos de XML salvos.');
    window.setTimeout(() => setNotice(''), 2500);
  };

  if (isLoading || !activeModelo) {
    return (
      <div className="submodule-content-card">
        <div className="sub-loading">Carregando modelos de XML...</div>
      </div>
    );
  }

  return (
    <div className="submodule-content-card xml-modelos-config">
      <div className="xml-modelos-header">
        <div>
          <h2>Modelos de Visualização XML</h2>
          <p>Edite o layout base usado para interpretar XML fiscal em Documentos.</p>
        </div>
        <button className="btn-save-settings" type="button" onClick={handleSave} disabled={saveMutation.isPending}>
          <Save size={16} /> {saveMutation.isPending ? 'Salvando...' : 'Salvar modelos'}
        </button>
      </div>

      {notice && <div className="success-banner">{notice}</div>}

      <div className="xml-modelos-tabs" role="tablist" aria-label="Tipos de XML">
        {tipos.map((tipo) => (
          <button
            type="button"
            className={`xml-modelos-tab ${activeTipo === tipo ? 'active' : ''}`}
            onClick={() => setActiveTipo(tipo)}
            key={tipo}
          >
            <FileCode2 size={14} /> {XML_MODELO_LABELS[tipo]}
          </button>
        ))}
      </div>

      <div className="xml-modelos-state-tabs" role="tablist" aria-label="Estado do XML">
        {estados.map((estado) => (
          <button
            type="button"
            className={`xml-modelos-state-tab ${activeEstado === estado.id ? 'active' : ''}`}
            onClick={() => setActiveEstado(estado.id)}
            key={estado.id}
          >
            {estado.label}
          </button>
        ))}
      </div>

      <div className="xml-modelos-editor">
        <div className="xml-modelos-form">
          <div className="xml-modelos-field">
            <label>Título do modelo</label>
            <input value={activeModelo.titulo} onChange={(event) => updateModelo({ titulo: event.target.value })} />
          </div>
          <div className="xml-modelos-field">
            <label>Descrição</label>
            <input value={activeModelo.descricao} onChange={(event) => updateModelo({ descricao: event.target.value })} />
          </div>
          <div className="xml-modelos-field">
            <label>Arquivo XML de exemplo</label>
            <input value={activeModelo.exemploUrl} onChange={(event) => updateModelo({ exemploUrl: event.target.value })} />
          </div>
          <div className="xml-modelos-field">
            <label>Campos exibidos</label>
            <input
              value={activeModelo.campos.join(', ')}
              onChange={(event) => updateModelo({ campos: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
            />
          </div>
          <div className="xml-modelos-field">
            <label>Modelo textual</label>
            <textarea value={activeModelo.modelo} onChange={(event) => updateModelo({ modelo: event.target.value })} />
          </div>
          <label className="xml-modelos-switch">
            <input type="checkbox" checked={activeModelo.ativo} onChange={(event) => updateModelo({ ativo: event.target.checked })} />
            Modelo ativo
          </label>
        </div>

        <aside className="xml-modelos-preview">
          <h3>{activeModelo.titulo}</h3>
          <ul>
            <li>Tipo: {XML_MODELO_LABELS[activeModelo.tipo]}</li>
            <li>Estado: {activeModelo.estado === 'cancelado' ? 'Cancelado' : 'Autorizado'}</li>
            <li>Campos: {activeModelo.campos.length}</li>
            <li>{activeModelo.sistema ? 'Modelo padrão do sistema' : 'Modelo personalizado'}</li>
          </ul>
          <a className="xml-modelos-sample" href={activeModelo.exemploUrl} target="_blank" rel="noreferrer">
            Abrir XML de exemplo
          </a>
        </aside>
      </div>
    </div>
  );
};
