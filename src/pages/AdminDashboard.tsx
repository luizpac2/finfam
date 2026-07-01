import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { userService } from '../services';
import type { User } from '../domain/entities/User';
import type { UserRole, UserStatus } from '../lib/database.types';
import {
  UserRoleLabel,
  UserStatusLabel,
  UserRoleValue,
} from '../domain/constants';
import { Card } from '../components/ui/Card';
import { FullScreenLoader } from '../components/ui/FullScreenLoader';
import { formatDate } from '../lib/format';

/**
 * Painel administrativo (somente Admin).
 * Permite convidar e-mails Google para a whitelist, definir a permissão
 * (Admin/Member) e revogar/reativar o acesso instantaneamente.
 */
export default function AdminDashboard() {
  const { profile } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Formulário de convite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRoleValue.MEMBER);
  const [inviting, setInviting] = useState(false);

  const loadMembers = async () => {
    try {
      setMembers(await userService.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAction = async (
    id: string,
    action: () => Promise<unknown>,
    successMessage: string
  ) => {
    setBusyId(id);
    try {
      await action();
      await loadMembers();
      toast.success(successMessage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operação falhou.');
    } finally {
      setBusyId(null);
    }
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    setInviting(true);
    try {
      const email = inviteEmail.trim();
      await userService.invite({ email, role: inviteRole }, profile?.id);
      setInviteEmail('');
      setInviteRole(UserRoleValue.MEMBER);
      await loadMembers();
      toast.success(`Convite enviado para ${email}.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Não foi possível convidar.'
      );
    } finally {
      setInviting(false);
    }
  };

  if (loading) return <FullScreenLoader label="Carregando administração…" />;

  return (
    <div className="space-y-6 sm:space-y-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-brand-moss sm:text-2xl">
          Administração
        </h1>
        <p className="mt-1 text-sm text-brand-gray">
          Gerencie quem pode acessar as finanças da família.
        </p>
      </header>

      <div>
        {/* Convidar novo e-mail */}
        <Card className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-brand-moss">
            Convidar membro
          </h2>
          <form
            onSubmit={handleInvite}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="flex-1">
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                E-mail do Google
              </span>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="membro@gmail.com"
                className="w-full rounded-lg border border-brand-moss/25 bg-white px-3 py-2 text-brand-gray outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/40"
              />
            </label>
            <label className="sm:w-44">
              <span className="mb-1 block text-sm font-medium text-brand-moss">
                Permissão
              </span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-brand-moss/25 bg-white px-3 py-2 text-brand-gray outline-none transition focus:border-brand-aqua focus:ring-2 focus:ring-brand-aqua/40"
              >
                <option value={UserRoleValue.MEMBER}>
                  {UserRoleLabel.member}
                </option>
                <option value={UserRoleValue.ADMIN}>
                  {UserRoleLabel.admin}
                </option>
              </select>
            </label>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-aqua px-5 py-2 font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
              {inviting ? 'Convidando…' : 'Convidar'}
            </button>
          </form>
        </Card>

        {/* Lista de membros */}
        <h2 className="mb-3 text-lg font-semibold text-brand-moss">
          Membros & convites
        </h2>
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-brand-moss/10">
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isSelf={member.id === profile?.id}
                busy={busyId === member.id}
                onSetRole={(role) =>
                  runAction(
                    member.id,
                    () => userService.setRole(member.id, role),
                    `Permissão de ${member.email} atualizada.`
                  )
                }
                onRevoke={() =>
                  runAction(
                    member.id,
                    () => userService.revoke(member.id),
                    `Acesso de ${member.email} revogado.`
                  )
                }
                onReactivate={() =>
                  runAction(
                    member.id,
                    () => userService.reactivate(member),
                    `Acesso de ${member.email} reativado.`
                  )
                }
                onRemove={() =>
                  runAction(
                    member.id,
                    () => userService.remove(member.id),
                    `${member.email} removido.`
                  )
                }
              />
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

const statusStyles: Record<UserStatus, string> = {
  active: 'bg-brand-aqua/25 text-brand-moss',
  invited: 'bg-brand-cream text-brand-moss',
  revoked: 'bg-red-100 text-red-700',
};

interface MemberRowProps {
  member: User;
  isSelf: boolean;
  busy: boolean;
  onSetRole: (role: UserRole) => void;
  onRevoke: () => void;
  onReactivate: () => void;
  onRemove: () => void;
}

function MemberRow({
  member,
  isSelf,
  busy,
  onSetRole,
  onRevoke,
  onReactivate,
  onRemove,
}: MemberRowProps) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-brand-moss">
            {member.fullName || member.email}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[member.status]}`}
          >
            {UserStatusLabel[member.status]}
          </span>
          {isSelf && (
            <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs text-brand-gray">
              você
            </span>
          )}
        </div>
        <p className="truncate text-xs text-brand-gray">
          {member.email} · desde {formatDate(member.createdAt.slice(0, 10))}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Alterar permissão (bloqueado para a própria conta) */}
        <select
          value={member.role}
          disabled={busy || isSelf}
          onChange={(e) => onSetRole(e.target.value as UserRole)}
          className="rounded-lg border border-brand-moss/25 bg-white px-2 py-1.5 text-sm text-brand-gray outline-none transition focus:border-brand-aqua disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Permissão de ${member.email}`}
        >
          <option value={UserRoleValue.MEMBER}>{UserRoleLabel.member}</option>
          <option value={UserRoleValue.ADMIN}>{UserRoleLabel.admin}</option>
        </select>

        {member.status === 'revoked' ? (
          <button
            type="button"
            disabled={busy}
            onClick={onReactivate}
            className="rounded-lg bg-brand-aqua px-3 py-1.5 text-sm font-medium text-brand-moss shadow-sm transition hover:brightness-95 disabled:opacity-60"
          >
            Reativar
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || isSelf}
            onClick={onRevoke}
            title={isSelf ? 'Você não pode revogar a si mesmo' : undefined}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Revogar
          </button>
        )}

        <button
          type="button"
          disabled={busy || isSelf}
          onClick={onRemove}
          title={isSelf ? 'Você não pode remover a si mesmo' : undefined}
          className="rounded-lg px-2 py-1.5 text-sm font-medium text-brand-gray transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Remover
        </button>
      </div>
    </li>
  );
}
