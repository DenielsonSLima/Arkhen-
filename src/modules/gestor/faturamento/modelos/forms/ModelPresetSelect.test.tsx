/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModelPresetSelect } from './ModelPresetSelect';
vi.mock('../queries/useFiscalModels',()=>({useFiscalModels:()=>({list:{data:[
 {id:'active',fiscalConfigId:'a',ativo:true,nome:'Correto',dados:{descricao:'Serviço'}},
 {id:'inactive',fiscalConfigId:'a',ativo:false,nome:'Inativo',dados:{}},
 {id:'other',fiscalConfigId:'b',ativo:true,nome:'Outro emitente',dados:{}},
]}})}));
afterEach(cleanup);
it('aplica somente preset ativo do emitente selecionado',()=>{
 const onApply=vi.fn();render(<ModelPresetSelect tenant="tenant" configId="a" disabled={false} onApply={onApply}/>);
 expect(screen.queryByRole('option',{name:'Inativo'})).toBeNull();
 expect(screen.queryByRole('option',{name:'Outro emitente'})).toBeNull();
 fireEvent.change(screen.getByLabelText('Preencher com modelo fiscal'),{target:{value:'active'}});
 expect(onApply).toHaveBeenCalledWith({descricao:'Serviço'});
});
