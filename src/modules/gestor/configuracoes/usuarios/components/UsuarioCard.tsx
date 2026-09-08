import { useId, useState } from 'react';
import { Clock3, Edit2, KeyRound, Mail, ShieldCheck, Trash2, UserRound, UserX } from 'lucide-react';
import { SystemQuickModal } from '../../../components/SystemQuickModal';
import { formatCpf } from '../../../../../lib/cpf';
import type { Usuario } from '../services/usuariosService';
import type { UsuarioInvitation } from '../services/usuarioInvitationsService';
import { hasPendingEmailInvitation } from '../queries/useUsuarioInvitationsQueries';
import { UsuarioInvitationStatus } from '../forms/UsuarioInvitationStatus';
import './UsuarioCard.css';

interface UsuarioCardProps {
  usuario: Usuario;
  invitation?: UsuarioInvitation;
  invitationLoading: boolean;
  invitationError: boolean;
  onEdit: (usuario: Usuario) => void;
  onInativar: (usuario: Usuario) => void;
  onResetPassword: (usuario: Usuario) => void;
  onExcluir: (usuario: Usuario) => void;
}

const weekdays = [1, 2, 3, 4, 5];
const getAccessSummary = (usuario: Usuario) => {
  if (!usuario.accessConfig.enabled) return 'Sem restrição de horário';
  const isWeekdays = usuario.accessConfig.days.length === weekdays.length
    && weekdays.every((day) => usuario.accessConfig.days.includes(day));
  const isCommercialHours = usuario.accessConfig.intervals.length === 1
    && usuario.accessConfig.intervals[0]?.start === '08:00'
    && usuario.accessConfig.intervals[0]?.end === '18:00';
  if (isWeekdays && isCommercialHours) return 'Dias úteis, das 08:00 às 18:00';
  const days = usuario.accessConfig.days.length === 7 ? 'Todos os dias' : `${usuario.accessConfig.days.length} dia(s)`;
  return `${days} · ${usuario.accessConfig.intervals.map((interval) => `${interval.start}–${interval.end}`).join(' / ')}`;
};

export const UsuarioCard = ({
  usuario, invitation, invitationLoading, invitationError,
  onEdit, onInativar, onResetPassword, onExcluir,
}: UsuarioCardProps) => {
  const headingId = useId();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const statusClass = usuario.status === 'Ativo' ? 'active' : usuario.status === 'Pendente' ? 'pending' : 'inactive';

  return (
    <>
      <article className="usuario-card" aria-labelledby={headingId}>
        <header className="usuario-card-header">
          <div className="usuario-card-avatar" aria-hidden="true"><UserRound size={21} /></div>
          <div className="usuario-card-identity">
            <h3 id={headingId}>{usuario.nome}</h3>
            <p>{usuario.perfil}</p>
          </div>
          <span className={`usuario-card-status ${statusClass}`}>{usuario.status}</span>
        </header>

        <dl className="usuario-card-details">
          <div className="usuario-card-email">
            <dt><Mail size={13} aria-hidden="true" /> E-mail</dt>
            <dd>{usuario.email || 'Não informado'}</dd>
          </div>
          <div>
            <dt>CPF</dt>
            <dd>{usuario.cpf ? formatCpf(usuario.cpf) : 'Não informado'}</dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>{usuario.telefone || 'Não informado'}</dd>
          </div>
          <div className="usuario-card-access">
            <dt><ShieldCheck size={13} aria-hidden="true" /> Forma de acesso</dt>
            <dd>
              {usuario.formaAcesso === 'cpf' ? 'CPF + senha' : 'E-mail + senha'}
              {usuario.mustChangePassword && <span className="usuario-card-first-access">Primeiro acesso pendente</span>}
            </dd>
          </div>
          <div className="usuario-card-schedule">
            <dt><Clock3 size={13} aria-hidden="true" /> Horário de acesso</dt>
            <dd>{getAccessSummary(usuario)}</dd>
          </div>
        </dl>

        {hasPendingEmailInvitation(usuario) && (
          <section className="usuario-card-invitation" aria-label={`Convite de ${usuario.nome}`}>
            <h4>Convite por e-mail</h4>
            <UsuarioInvitationStatus
              usuario={usuario}
              invitation={invitation}
              isLoading={invitationLoading}
              isError={invitationError}
            />
          </section>
        )}

        <footer className="usuario-card-actions">
          <button type="button" onClick={() => onEdit(usuario)} aria-label={`Editar ${usuario.nome}`}>
            <Edit2 size={14} aria-hidden="true" /> Editar
          </button>
          {usuario.status !== 'Inativo' && (
            <button type="button" onClick={() => onInativar(usuario)} aria-label={`Inativar ${usuario.nome}`}>
              <UserX size={14} aria-hidden="true" /> Inativar
            </button>
          )}
          {usuario.formaAcesso === 'cpf' && usuario.authUserId && (
            <button type="button" onClick={() => onResetPassword(usuario)} aria-label={`Redefinir senha de ${usuario.nome}`}>
              <KeyRound size={14} aria-hidden="true" /> Redefinir senha
            </button>
          )}
          {!usuario.authUserId && (
            <button type="button" className="usuario-card-action-danger" onClick={() => setConfirmDelete(true)} aria-label={`Excluir cadastro de ${usuario.nome}`}>
              <Trash2 size={14} aria-hidden="true" /> Excluir cadastro
            </button>
          )}
        </footer>
      </article>
      <SystemQuickModal
        isOpen={confirmDelete}
        title="Excluir cadastro?"
        message={`O cadastro de ${usuario.nome}, sem conta de acesso, será excluído.`}
        confirmLabel="Excluir cadastro"
        onConfirm={() => onExcluir(usuario)}
        onClose={() => setConfirmDelete(false)}
        danger
      />
    </>
  );
};
