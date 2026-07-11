import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, UserRoundCheck } from 'lucide-react';
import {
  getCategoriaPadraoPorTipo,
  type CategoriaEvento,
  type CategoriaEventoConfig,
  type Evento,
  type TipoEventoConfig,
  type UsuarioAgenda,
} from '../services/agenda.service';

interface EventoModalProps {
  aberto: boolean;
  onClose: () => void;
  onSalvar: (evento: Omit<Evento, 'id'> & { id?: string }) => void;
  evento?: Evento | null;
  empresas: { id: string; nome: string }[];
  usuarioAtual: UsuarioAgenda;
  usuariosAtribuiveis: UsuarioAgenda[];
  dataInicial?: string | null;
  tiposEvento: TipoEventoConfig[];
  categoriasEvento: CategoriaEventoConfig[];
}

const COR_PADRAO = '#64748b';

const normalizarCor = (valor: string) => {
  if (!valor || typeof valor !== 'string') return COR_PADRAO;
  const cor = valor.trim().toLowerCase();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cor)) return COR_PADRAO;
  return cor.length === 4 ? `#${cor[1]}${cor[1]}${cor[2]}${cor[2]}${cor[3]}${cor[3]}` : cor;
};

const normalizarTipoId = (valor: string) => String(valor || '').trim();

const criarCorFundo = (cor: string) => {
  const corNormal = normalizarCor(cor).replace('#', '');
  const r = parseInt(corNormal.slice(0, 2), 16);
  const g = parseInt(corNormal.slice(2, 4), 16);
  const b = parseInt(corNormal.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
};

export const EventoModal: React.FC<EventoModalProps> = ({
  aberto,
  onClose,
  onSalvar,
  evento,
  empresas,
  usuarioAtual,
  usuariosAtribuiveis,
  dataInicial,
  tiposEvento,
  categoriasEvento,
}) => {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<string>('');
  const [categoriaId, setCategoriaId] = useState<CategoriaEvento>('operacional');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [recorrente, setRecorrente] = useState(false);
  const [periodoRecorrencia, setPeriodoRecorrencia] = useState<'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [responsavelId, setResponsavelId] = useState(usuarioAtual.id);
  const podeAtribuirParaOutros = usuariosAtribuiveis.some((usuario) => usuario.id !== usuarioAtual.id);

  const tiposDisponiveis = useMemo(() => tiposEvento.filter((item) => item.ativo), [tiposEvento]);
  const categoriasDisponiveis = useMemo(() => categoriasEvento.filter((item) => item.ativo), [categoriasEvento]);
  const tipoPadrao = useMemo(() => tiposDisponiveis[0]?.id || tiposEvento[0]?.id || 'tarefa', [tiposDisponiveis, tiposEvento]);
  const categoriaPadrao = useMemo(() => {
    const fallback = getCategoriaPadraoPorTipo(tipoPadrao);
    return categoriasDisponiveis.find((cat) => cat.id === fallback)?.id || categoriasDisponiveis[0]?.id || 'operacional';
  }, [categoriasDisponiveis, tipoPadrao]);

  const tiposRender = useMemo(() => {
    const itens = [...tiposEvento];
    if (tipo && !itens.some((item) => item.id === tipo)) {
      itens.push({
        id: tipo,
        label: tipo,
        cor: COR_PADRAO,
        corFundo: criarCorFundo(COR_PADRAO),
        ativo: true,
      });
    }
    return itens;
  }, [tipo, tiposEvento]);

  const categoriasRender = useMemo(() => {
    const itens = [...categoriasEvento];
    if (categoriaId && !itens.some((item) => item.id === categoriaId)) {
      itens.push({
        id: categoriaId,
        label: categoriaId,
        cor: COR_PADRAO,
        corFundo: criarCorFundo(COR_PADRAO),
        ativo: true,
      });
    }
    return itens;
  }, [categoriaId, categoriasEvento]);

  useEffect(() => {
    if (evento) {
      setTitulo(evento.titulo);
      const tipoEvento = normalizarTipoId(evento.tipo);
      setTipo(tipoEvento);
      const categoriaSelecionada = evento.categoriaId || getCategoriaPadraoPorTipo(tipoEvento);
      setCategoriaId(categoriaSelecionada as CategoriaEvento);
      setData(evento.data);
      setHora(evento.hora || '');
      setEmpresaId(evento.empresaId || '');
      setDescricao(evento.descricao || '');
      setRecorrente(evento.recorrente || false);
      setPeriodoRecorrencia(evento.periodoRecorrencia || 'mensal');
      setResponsavelId(evento.responsavelId || usuarioAtual.id);
    } else {
      setTitulo('');
      setTipo(tipoPadrao);
      setCategoriaId(categoriaPadrao as CategoriaEvento);
      setData(dataInicial || new Date().toISOString().split('T')[0]);
      setHora('');
      setEmpresaId('');
      setDescricao('');
      setRecorrente(false);
      setPeriodoRecorrencia('mensal');
      setResponsavelId(usuarioAtual.id);
    }
  }, [evento, dataInicial, aberto, usuarioAtual.id, categoriaPadrao, tipoPadrao]);

  if (!aberto) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !data) return;

    const emp = empresas.find(c => c.id === empresaId);
    const responsavel = usuariosAtribuiveis.find((usuario) => usuario.id === responsavelId) || usuarioAtual;

    onSalvar({
      id: evento?.id,
      titulo,
      tipo,
      categoriaId,
      data,
      hora: hora || undefined,
      empresaId: empresaId || undefined,
      empresaNome: emp ? emp.nome : undefined,
      responsavelId: responsavel.id,
      responsavelNome: responsavel.nome,
      responsavelPerfil: responsavel.perfil,
      criadoPorId: evento?.criadoPorId || usuarioAtual.id,
      criadoPorNome: evento?.criadoPorNome || usuarioAtual.nome,
      descricao: descricao || undefined,
      recorrente,
      periodoRecorrencia: recorrente ? periodoRecorrencia : undefined
    });
  };

  return (
    <div className="evento-modal-backdrop" onClick={onClose}>
      <div className="evento-modal" onClick={e => e.stopPropagation()}>
        <h2>
          <CalendarDays size={20} color="#c59235" />
          {evento ? 'Editar Evento' : 'Novo Evento'}
        </h2>

      <form onSubmit={handleSubmit}>
        <div className="modal-field">
          <label>Título *</label>
            <input
              type="text"
              required
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Reunião com diretoria"
            />
          </div>

          <div className="evento-modal-grid-2">
            <div className="modal-field">
              <label>Tipo de Evento</label>
              <div className="modal-tipo-grid">
                {tiposRender.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`modal-tipo-btn ${tipo === item.id ? 'active' : ''}`}
                    style={{
                      backgroundColor: tipo === item.id ? item.cor : 'transparent',
                      borderColor: tipo === item.id ? item.cor : '#e2e8f0',
                    }}
                    onClick={() => {
                      setTipo(item.id);
                      const padrao = getCategoriaPadraoPorTipo(item.id);
                      setCategoriaId(categoriasEvento.some((cat) => cat.id === padrao) ? padrao : (categoriasEvento[0]?.id || 'operacional'));
                    }}
                  >
                    <span
                      className="filtro-dot"
                      style={{ backgroundColor: tipo === item.id ? '#fff' : item.cor }}
                    />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-field">
              <label>Categoria</label>
              <div className="modal-categoria-grid">
                {categoriasRender.map((categoria) => (
                  <button
                    key={categoria.id}
                    type="button"
                    className={`modal-categoria-btn ${categoriaId === categoria.id ? 'active' : ''}`}
                    style={{
                      backgroundColor: categoriaId === categoria.id ? categoria.corFundo : '#fff',
                      borderColor: categoriaId === categoria.id ? categoria.cor : '#e2e8f0',
                      color: categoriaId === categoria.id ? categoria.cor : '#64748b',
                    }}
                    onClick={() => setCategoriaId(categoria.id)}
                  >
                    <span className="filtro-dot" style={{ backgroundColor: categoria.cor }} />
                    {categoria.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="modal-field">
              <label>Data *</label>
              <input
                type="date"
                required
                value={data}
                onChange={e => setData(e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label>Hora (opcional)</label>
              <input
                type="time"
                value={hora}
                onChange={e => setHora(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-field">
            <label>Empresa Vinculada (opcional)</label>
            <select value={empresaId} onChange={e => setEmpresaId(e.target.value)}>
              <option value="">Nenhuma empresa</option>
              {empresas.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nome}</option>
              ))}
            </select>
          </div>

          <div className="modal-field">
            <label>Responsável</label>
            <div className="responsavel-selector">
              <UserRoundCheck size={16} />
              <select
                value={responsavelId}
                onChange={e => setResponsavelId(e.target.value)}
                disabled={!podeAtribuirParaOutros}
              >
                {usuariosAtribuiveis.map(usuario => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.id === usuarioAtual.id ? 'Minha agenda' : `${usuario.nome} — ${usuario.perfil}`}
                  </option>
                ))}
              </select>
            </div>
            <small className="modal-helper-text">
              {podeAtribuirParaOutros
                ? 'Gestores podem atribuir tarefas apenas para usuários de hierarquia menor.'
                : 'Seu perfil permite criar compromissos apenas para sua própria agenda.'}
            </small>
          </div>

          <div className="modal-field">
            <label>Descrição / Observações</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Notas adicionais sobre a tarefa ou reunião..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0 6px 0' }}>
            <input
              type="checkbox"
              id="recorrente-chk"
              checked={recorrente}
              onChange={e => setRecorrente(e.target.checked)}
            />
            <label htmlFor="recorrente-chk" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
              Este evento se repete periodicamente
            </label>
          </div>

          {recorrente && (
            <div className="modal-field animate-slide-down">
              <label>Período de Recorrência</label>
              <select
                value={periodoRecorrencia}
                onChange={e => setPeriodoRecorrencia(e.target.value as never)}
              >
                <option value="mensal">Mensal</option>
                <option value="bimestral">Bimestral</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal-save">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
