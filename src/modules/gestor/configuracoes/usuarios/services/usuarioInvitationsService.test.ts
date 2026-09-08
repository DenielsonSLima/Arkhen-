import { FunctionsHttpError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('../../../../../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));
import { usuarioInvitationsService } from './usuarioInvitationsService';

describe('usuarioInvitationsService', () => {
  beforeEach(() => vi.resetAllMocks());

  it('consulta o lote de convites sem enviar convite nem fornecer tenant pelo cliente', async () => {
    const invitation = {
      usuario_id: 'usuario-1', invited_at: null,
      confirmation_sent_at: null, email_confirmed_at: null,
    };
    mocks.invoke.mockResolvedValue({ data: { ok: true, invitations: [invitation] }, error: null });

    expect(await usuarioInvitationsService.list()).toEqual([invitation]);
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('manage-employee-user', {
      body: { action: 'email_invitation_status' },
    });
  });

  it.each([{}, { invitations: [{}] }, { invitations: [{ usuario_id: 'usuario-1' }] }])(
    'não trata resposta incompleta como convite não enviado: %j', async (payload) => {
      mocks.invoke.mockResolvedValue({ data: { ok: true, ...payload }, error: null });
      await expect(usuarioInvitationsService.list()).rejects.toThrow('O status dos convites não foi retornado.');
    },
  );

  it('aceita envio somente quando o backend confirma invite_sent', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, invite_sent: true }, error: null });

    await expect(usuarioInvitationsService.resend('usuario-1')).resolves.toBeUndefined();
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('manage-employee-user', {
      body: { action: 'resend_email_invite', usuario_id: 'usuario-1' },
    });
  });

  it.each([undefined, false])('não declara envio confirmado com invite_sent=%s', async (inviteSent) => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, invite_sent: inviteSent }, error: null });
    await expect(usuarioInvitationsService.resend('usuario-1')).rejects.toThrow('O envio do convite não foi confirmado.');
  });

  it('preserva mensagem segura de falha e não reenvia automaticamente', async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({ error: 'Convite já aceito.' }), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      })),
    });
    await expect(usuarioInvitationsService.resend('usuario-1')).rejects.toThrow('Convite já aceito.');
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
});
