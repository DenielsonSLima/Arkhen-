import { Check, Circle, FileCog, ShieldCheck } from 'lucide-react';
import { useToggleChecklistMutation } from '../hooks/useReformaTributariaQueries';
import type { ChecklistItemId, ReformaCliente } from '../services/reformaTributaria.types';
import { AdequacaoForm } from '../forms/AdequacaoForm';
import { ClienteSelector, EmptyState, ReformaStatusBadge } from './ReformaShared';

const CHECKLIST: Array<{ id: ChecklistItemId; label: string; description: string }> = [
  { id: 'emissor_atualizado', label: 'Emissor atualizado', description: 'Versão compatível com os novos leiautes.' },
  { id: 'cadastros_revisados', label: 'Cadastros revisados', description: 'Produtos, serviços, NCM e NBS conferidos.' },
  { id: 'cst_configurado', label: 'CST configurado', description: 'Situações tributárias definidas.' },
  { id: 'classificacao_configurada', label: 'cClassTrib configurado', description: 'Classificação tributária revisada.' },
  { id: 'aliquotas_configuradas', label: 'Alíquotas configuradas', description: 'IBS e CBS parametrizados no emissor.' },
  { id: 'totalizadores_configurados', label: 'Totalizadores conferidos', description: 'Totais do documento fiscal consistentes.' },
  { id: 'xml_emitido', label: 'XML emitido', description: 'Documento de teste disponível.' },
  { id: 'xml_validado', label: 'XML validado', description: 'Evidência técnica aprovada no sistema.' },
];

interface Props {
  clientes: ReformaCliente[];
  cliente: ReformaCliente | null;
  clienteId: string;
  onClientChange: (id: string) => void;
}

export const AdequacaoTab = ({ clientes, cliente, clienteId, onClientChange }: Props) => {
  const toggleMutation = useToggleChecklistMutation();
  return (
    <div className="rtc-tab-stack">
      <ClienteSelector clientes={clientes} value={clienteId} onChange={onClientChange} />
      {!cliente ? <EmptyState title="Selecione um cliente" description="Escolha um CNPJ para iniciar o checklist de adequação." /> : (
        <div className="rtc-two-columns">
          <section className="rtc-panel">
            <header className="rtc-panel-header"><div><span className="rtc-eyebrow">Configuração do CNPJ</span><h2>{cliente.nome}</h2></div><ReformaStatusBadge status={cliente.status} /></header>
            <div className="rtc-client-summary"><span><FileCog size={15} /> {cliente.regime}</span><span><ShieldCheck size={15} /> {cliente.cnpj}</span></div>
            <AdequacaoForm cliente={cliente} />
          </section>
          <section className="rtc-panel">
            <header className="rtc-panel-header"><div><span className="rtc-eyebrow">Evidências operacionais</span><h2>Checklist obrigatório</h2></div></header>
            <div className="rtc-checklist">
              {CHECKLIST.map((item) => {
                const completed = cliente.checklist[item.id] === true;
                const automaticEvidence = item.id === 'xml_emitido' || item.id === 'xml_validado';
                return <button type="button" key={item.id} className={completed ? 'completed' : ''} disabled={toggleMutation.isPending || automaticEvidence} title={automaticEvidence ? 'Atualizado automaticamente pelo validador XML' : undefined} onClick={() => toggleMutation.mutate({ clienteId: cliente.id, item: item.id, concluido: !completed })}><span>{completed ? <Check size={15} /> : <Circle size={15} />}</span><div><strong>{item.label}</strong><small>{item.description}</small></div></button>;
              })}
            </div>
            {toggleMutation.error && <div className="rtc-form-error">{toggleMutation.error.message}</div>}
          </section>
        </div>
      )}
    </div>
  );
};
