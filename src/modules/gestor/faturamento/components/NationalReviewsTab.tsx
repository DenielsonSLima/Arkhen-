import {useNationalReviewRealtime} from '../forms/nacional/useNationalReviewRealtime';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFiscalBillingTenant, useFiscalEmitters } from '../queries/useFaturamentoFiscalQueries';
import { listNationalReviews, type NationalReviewRow } from '../forms/nacional/nationalListService';
import { NationalDraftForm } from '../forms/nacional/NationalDraftForm';
const labels:Record<string,string>={REVIEWED_ONLY:'Revisada, não emitida',REVIEW_REQUIRED:'Revisão necessária',PREPARED_LOCKED:'Preparada, somente leitura'};
export function NationalReviewsTab() {
 const tenant=useFiscalBillingTenant();
 if(!tenant.data) return <p role={tenant.isError?'alert':'status'}>{tenant.isError?'Não foi possível identificar a empresa.':'Carregando empresa...'}</p>;
 return <NationalReviewsContent key={tenant.data} tenant={tenant.data}/>;
}
function NationalReviewsContent({tenant}:{tenant:string}) {
 useNationalReviewRealtime(tenant);
 const emitters=useFiscalEmitters(tenant);const [config,setConfig]=useState('');
 return <section className="fiscal-models" aria-label="Revisões NFS-e Nacional">
  <p>NFS-e Nacional em homologação. Esta lista contém revisões internas, não notas emitidas. Emissão e cancelamento permanecem indisponíveis.</p>
  <label>Emitente<select value={config} onChange={e=>setConfig(e.target.value)}><option value="">Selecione o emitente</option>
   {emitters.data?.map(item=><option key={item.id} value={item.id}>{item.prestadorNome}</option>)}</select></label>
  {emitters.isError&&<p role="alert">Não foi possível carregar os emitentes.</p>}
  {config&&<ReviewList key={`${tenant}-${config}`} tenant={tenant} config={config}/>}
 </section>;
}
function ReviewList({tenant,config}:{tenant:string;config:string}) {
 const [serviceReference,setServiceReference]=useState('');const [newService,setNewService]=useState('');
 const [offset,setOffset]=useState(0);const [selected,setSelected]=useState<NationalReviewRow>();
 const query=useQuery({queryKey:['faturamento','national-reviews',tenant,config,offset],queryFn:()=>listNationalReviews(config,offset),staleTime:0,retry:false});
 return <>
  <div className="fiscal-model-toolbar"><label>Referência única do serviço<input value={serviceReference} maxLength={80} placeholder="Ex.: CONTRATO-2026-001" onChange={e=>setServiceReference(e.target.value.toUpperCase().trim())}/></label>
   <button type="button" className="faturamento-btn-primary" disabled={!/^[A-Z0-9][A-Z0-9._/-]{2,79}$/.test(serviceReference)} onClick={()=>setNewService(serviceReference)}>Novo serviço / reabrir</button></div>
  <p>Use sempre a mesma referência para o mesmo serviço. Referências diferentes não impedem duplicidade do serviço real. Nenhuma cobrança será criada.</p>
  {newService&&<NationalDraftForm key={newService} tenantId={tenant} configId={config} chargeId="" serviceReference={newService} backLabel="Voltar à lista" onBack={()=>setNewService('')} onClose={()=>setNewService('')}/>}
  {query.isPending&&<p role="status">Carregando revisões...</p>}
  {query.isError&&<p role="alert">{query.error.message}<button type="button" onClick={()=>void query.refetch()}>Tentar novamente</button></p>}
  {!query.isPending&&!query.isError&&query.data?.items.length===0&&<p>Nenhuma revisão nacional encontrada. Prepare uma cobrança e escolha a revisão nacional para começar.</p>}
  <div className="fiscal-model-list">{query.data?.items.map(row=><article className="fiscal-model-card" key={row.draftId}>
   <div><h3>{row.recipientName}</h3>{row.serviceReference&&<p>Serviço: {row.serviceReference}</p>}<p>Competência: {row.competence} · Valor: R$ {row.amount.replace('.',',')}</p><p>{labels[row.state]||'Estado não reconhecido'}</p></div>
   <button type="button" className="faturamento-btn-secondary" disabled={!labels[row.state]} onClick={()=>setSelected(row)}>Abrir revisão</button>
  </article>)}</div>
  <nav aria-label="Paginação das revisões nacionais"><button type="button" disabled={offset===0||query.isFetching} onClick={()=>setOffset(value=>Math.max(0,value-25))}>Anterior</button>
   <span>Página {offset/25+1}</span><button type="button" disabled={!query.data?.hasMore||query.isFetching||offset>=10000} onClick={()=>setOffset(value=>value+25)}>Próxima</button></nav>
  {selected&&<NationalDraftForm tenantId={tenant} configId={config} chargeId={selected.chargeId} serviceReference={selected.serviceReference||undefined} backLabel="Voltar à lista" onBack={()=>setSelected(undefined)} onClose={()=>setSelected(undefined)}/>}
 </>;
}
