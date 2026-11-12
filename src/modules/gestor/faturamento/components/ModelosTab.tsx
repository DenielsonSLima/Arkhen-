import { useState } from 'react';
import { Plus, Copy, Pencil, Power } from 'lucide-react';
import { SystemQuickModal } from '../../components/SystemQuickModal';
import { useFiscalBillingTenant, useFiscalEmitters } from '../queries/useFaturamentoFiscalQueries';
import { useFiscalModels } from '../modelos/queries/useFiscalModels';
import { ModelEditor } from '../modelos/forms/ModelEditor';
import type { FiscalModel, ModelInput } from '../modelos/services/modelosFiscalService';
import '../modelos/modelos.css';
export function ModelosTab({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const tenant = useFiscalBillingTenant();
  if (!tenant.data) return <p role={tenant.isError ? 'alert' : 'status'}>{tenant.isError ? 'Não foi possível identificar a empresa.' : 'Carregando empresa...'}</p>;
  return <ModelsContent key={tenant.data} tenant={tenant.data} onOpenSettings={onOpenSettings} />;
}
function ModelsContent({ tenant, onOpenSettings }: { tenant: string; onOpenSettings?: () => void }) {
  const models = useFiscalModels(tenant);
  const emitters = useFiscalEmitters(tenant);
  const [editor, setEditor] = useState<ModelInput>();
  const [selected, setSelected] = useState<FiscalModel>();
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState('');
  const busy = models.save.isPending || models.activate.isPending;
  const openNew = (source?: FiscalModel) => {
    setError(''); setEditor({ id: crypto.randomUUID(), versao: 0, nome: source ? `${source.nome.slice(0,90)} (cópia)` : '',
      fiscalConfigId: source?.fiscalConfigId || '', dados: source ? { ...source.dados } : {} });
  };
  const rows = (models.list.data || []).filter(row => (includeInactive || row.ativo)
    && row.nome.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  return <section className="fiscal-models" aria-label="Modelos fiscais">
    <div className="fiscal-model-toolbar"><label>Buscar modelo<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label className="fiscal-model-checkbox"><input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />Mostrar inativos</label>
      <button type="button" className="faturamento-btn-primary" disabled={busy || models.list.isError || !emitters.data?.length} onClick={() => openNew()}><Plus size={16} />Novo modelo</button>
    </div>
    {models.list.isError && <p role="alert">{models.list.error.message}</p>}
    {emitters.isError && <p role="alert">Não foi possível carregar os emitentes.</p>}
    {!emitters.isPending && !emitters.isError && !emitters.data?.length && <p>Cadastre um emitente WebISS para criar modelos. {onOpenSettings && <button type="button" onClick={onOpenSettings}>Configurações</button>}</p>}
    {editor && <ModelEditor key={editor.id} initial={editor} emitters={emitters.data || []} busy={busy}
      onClose={() => setEditor(undefined)} onSave={async input => { await models.save.mutateAsync(input); setEditor(undefined); }} />}
    {models.list.isPending && <p role="status">Carregando modelos...</p>}
    {!models.list.isPending && !models.list.isError && rows.length === 0 && <p>Nenhum modelo encontrado.</p>}
    <div className="fiscal-model-list">{rows.map(model => <article className="fiscal-model-card" key={model.id}>
      <div><h3>{model.nome}</h3><p>{emitters.data?.find(item => item.id === model.fiscalConfigId)?.prestadorNome || 'Emitente cadastrado'} · WebISS · {model.ativo ? 'Ativo' : 'Inativo'}</p>
        <p className="fiscal-model-description">{model.dados.descricao}</p></div>
      <div className="fiscal-model-actions">
        <button type="button" className="faturamento-btn-secondary" disabled={busy || !model.ativo} onClick={() => setEditor(model)}><Pencil size={14} />Editar</button>
        <button type="button" className="faturamento-btn-secondary" disabled={busy} onClick={() => openNew(model)}><Copy size={14} />Clonar</button>
        <button type="button" className="faturamento-btn-secondary" disabled={busy} onClick={() => { setError(''); setSelected(model); }}><Power size={14} />{model.ativo ? 'Inativar' : 'Reativar'}</button>
      </div></article>)}</div>
    {error && <p role="alert">{error}</p>}
    <SystemQuickModal isOpen={!!selected} title={selected?.ativo ? 'Inativar modelo?' : 'Reativar modelo?'}
      message="As notas já preparadas e emitidas não serão alteradas. O histórico será preservado."
      onClose={() => setSelected(undefined)} onConfirm={async () => { if (!selected) return;
        try { await models.activate.mutateAsync({ model: selected, active: !selected.ativo }); }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível alterar o modelo.'); throw cause; } }} />
  </section>;
}
