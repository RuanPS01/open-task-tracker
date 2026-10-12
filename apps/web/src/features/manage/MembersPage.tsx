// Membros do workspace: função, capacidade semanal (usada na Linha do tempo) e
// valor/hora (usado nos relatórios). Só administradores alteram. Gente nova entra
// por link de convite (não há servidor para criar a conta de outra pessoa).
import type { Invite, Member, MemberRole } from '@ott/shared';
import clsx from 'clsx';
import { Copy, MoreHorizontal, Pencil, Power, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCreateInvite,
  useInvites,
  useMembers,
  useRemoveMember,
  useRevokeInvite,
  useUpdateMember,
} from '../../data/workspace';
import { useCurrentUser, useIsAdmin, useWorkspace } from '../../app/session';
import { Avatar } from '../../components/ui/Avatar';
import { Button, IconButton } from '../../components/ui/Button';
import { useConfirm } from '../../components/ui/Confirm';
import { LoadingBlock } from '../../components/ui/EmptyState';
import { Field, Input, Select } from '../../components/ui/Field';
import { Menu } from '../../components/ui/Menu';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { PageHeader } from '../../layout/PageHeader';
import { useFormat } from '../../lib/format';
import styles from './Manage.module.css';

interface MemberValues {
  role: MemberRole;
  weeklyCapacityHours: number;
  hourlyRate: number | null;
}

/** Campos comuns da edição de membro e do convite: função, capacidade e valor/hora. */
function MemberFields({ initial, onChange }: { initial?: Partial<MemberValues>; onChange: (values: MemberValues) => void }) {
  const t = useT();
  const workspace = useWorkspace();
  const [role, setRole] = useState<MemberRole>(initial?.role ?? 'member');
  const [capacity, setCapacity] = useState(String(initial?.weeklyCapacityHours ?? 40));
  const [rate, setRate] = useState(initial?.hourlyRate?.toString() ?? '');

  useEffect(() => {
    const weeklyCapacityHours = Number.parseFloat(capacity.replace(',', '.'));
    const hourlyRate = rate.trim() ? Number.parseFloat(rate.replace(',', '.')) : null;
    onChange({
      role,
      weeklyCapacityHours: Number.isFinite(weeklyCapacityHours) ? weeklyCapacityHours : 40,
      hourlyRate: hourlyRate !== null && Number.isFinite(hourlyRate) ? hourlyRate : null,
    });
  }, [role, capacity, rate, onChange]);

  return (
    <>
      <Field label={t.members.role}>
        {(id) => (
          <Select id={id} value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
            <option value="member">{t.members.member}</option>
            <option value="admin">{t.members.admin}</option>
          </Select>
        )}
      </Field>
      <div className={styles.grid}>
        <Field label={t.members.capacity}>{(id) => <Input id={id} inputMode="decimal" value={capacity} onChange={(e) => setCapacity(e.target.value)} />}</Field>
        <Field label={`${t.members.hourlyRate} (${workspace.currency})`}>
          {(id) => <Input id={id} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={workspace.defaultHourlyRate?.toString() ?? ''} />}
        </Field>
      </div>
    </>
  );
}

function MemberDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const t = useT();
  const update = useUpdateMember();
  const [values, setValues] = useState<MemberValues | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      persistent
      title={t.members.edit}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            loading={update.isPending}
            disabled={!values}
            onClick={() => values && update.mutate({ userId: member.userId, ...values }, { onSuccess: onClose })}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <MemberFields initial={member} onChange={setValues} />
    </Modal>
  );
}

/** Endereço completo do link de convite (respeita o subcaminho do GitHub Pages). */
export const inviteLink = (invite: Invite) =>
  `${window.location.origin}${import.meta.env.BASE_URL}invite/${invite.workspaceId}/${invite.id}`;

function CopyLink({ invite }: { invite: Invite }) {
  const t = useT();
  const link = inviteLink(invite);
  return (
    <div className={styles.password}>
      <code className={styles.link}>{link}</code>
      <IconButton
        icon={<Copy />}
        label={t.members.copyLink}
        size="sm"
        onClick={() => {
          void navigator.clipboard?.writeText(link);
          toast.success(t.common.copied);
        }}
      />
    </div>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const create = useCreateInvite();
  const [email, setEmail] = useState('');
  const [values, setValues] = useState<MemberValues | null>(null);
  const [created, setCreated] = useState<Invite | null>(null);

  if (created) {
    return (
      <Modal
        open
        onClose={onClose}
        title={t.members.inviteLinkTitle}
        width={520}
        footer={
          <Button variant="primary" onClick={onClose}>
            {t.common.close}
          </Button>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{t.members.inviteLinkText}</p>
        <CopyLink invite={created} />
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      persistent
      title={t.members.inviteTitle}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            disabled={!values}
            onClick={() =>
              values && create.mutate({ email: email.trim() || null, ...values }, { onSuccess: (invite) => setCreated(invite) })
            }
          >
            {t.members.inviteCreate}
          </Button>
        </>
      }
    >
      <Field label={t.members.inviteEmail} hint={t.members.inviteEmailHint}>
        {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />}
      </Field>
      <MemberFields onChange={setValues} />
    </Modal>
  );
}

function PendingInvites() {
  const t = useT();
  const format = useFormat();
  const confirm = useConfirm();
  const { data: invites = [] } = useInvites(true);
  const revoke = useRevokeInvite();
  if (invites.length === 0) return null;
  const revokeInvite = async (invite: Invite) => {
    const ok = await confirm({ title: t.members.revokeTitle, text: t.members.revokeText, confirmLabel: t.members.revoke, danger: true });
    if (ok) revoke.mutate(invite.id);
  };
  return (
    <>
      <h2 className={styles.sectionTitle}>{t.members.pendingInvites}</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t.members.email}</th>
            <th>{t.members.role}</th>
            <th>{t.members.capacityShort}</th>
            <th>{t.members.createdAt}</th>
            <th className={styles.actions} />
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => (
            <tr key={invite.id}>
              <td className={styles.muted}>{invite.email ?? t.members.noEmail}</td>
              <td>
                <span className={clsx(styles.badge, invite.role === 'admin' && styles.badgeAdmin)}>
                  {invite.role === 'admin' ? t.members.admin : t.members.member}
                </span>
              </td>
              <td className={styles.muted}>{t.members.hoursPerWeek(invite.weeklyCapacityHours)}</td>
              <td className={styles.muted}>{format.fullDate(invite.createdAt)}</td>
              <td className={styles.actions}>
                <Menu
                  placement="bottom-end"
                  trigger={({ ref, getProps }) => <IconButton ref={ref} icon={<MoreHorizontal />} label={t.common.more} size="sm" {...getProps()} />}
                  items={[
                    {
                      key: 'copy',
                      label: t.members.copyLink,
                      icon: <Copy />,
                      onSelect: () => {
                        void navigator.clipboard?.writeText(inviteLink(invite));
                        toast.success(t.common.copied);
                      },
                    },
                    'separator',
                    { key: 'revoke', label: t.members.revoke, icon: <Trash2 />, danger: true, onSelect: () => void revokeInvite(invite) },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function MembersPage() {
  const t = useT();
  const format = useFormat();
  const confirm = useConfirm();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const workspace = useWorkspace();
  const { data: members = [], isLoading } = useMembers();
  const update = useUpdateMember();
  const remove = useRemoveMember();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Member | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (params.get('add') && isAdmin) {
      setInviting(true);
      setParams({}, { replace: true });
    }
  }, [params, isAdmin, setParams]);

  const removeMember = async (member: Member) => {
    const ok = await confirm({ title: t.members.removeTitle, text: t.members.removeText, confirmLabel: t.common.remove, danger: true });
    if (ok) remove.mutate(member.userId);
  };

  return (
    <>
      <PageHeader
        title={t.members.title}
        subtitle={String(members.length)}
        actions={
          isAdmin && (
            <Button variant="primary" icon={<UserPlus />} onClick={() => setInviting(true)}>
              {t.members.add}
            </Button>
          )
        }
      />
      <div className={styles.body}>
        {!isAdmin && <p className={styles.notice}>{t.members.adminOnly}</p>}
        {isLoading ? (
          <LoadingBlock />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.members.name}</th>
                <th>{t.members.email}</th>
                <th>{t.members.role}</th>
                <th>{t.members.capacityShort}</th>
                <th>{t.members.hourlyRate}</th>
                <th>{t.members.status}</th>
                <th>{t.members.joined}</th>
                <th className={styles.actions} />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} className={clsx(!member.active && styles.inactive)}>
                  <td>
                    <span className={styles.person}>
                      <Avatar name={member.name} color={member.avatarColor} size={28} />
                      {member.name}
                      {member.userId === user.id && <span className={styles.you}>({t.members.you})</span>}
                    </span>
                  </td>
                  <td className={styles.muted}>{member.email}</td>
                  <td>
                    <span className={clsx(styles.badge, member.role === 'admin' && styles.badgeAdmin)}>
                      {member.role === 'admin' ? t.members.admin : t.members.member}
                    </span>
                  </td>
                  <td className={styles.muted}>{t.members.hoursPerWeek(member.weeklyCapacityHours)}</td>
                  <td className={styles.muted}>
                    {member.hourlyRate !== null ? format.money(member.hourlyRate, workspace.currency) : '-'}
                  </td>
                  <td>
                    <span className={clsx(styles.badge, !member.active && styles.badgeInactive)}>
                      {member.active ? t.members.active : t.members.inactive}
                    </span>
                  </td>
                  <td className={styles.muted}>{format.fullDate(member.joinedAt)}</td>
                  <td className={styles.actions}>
                    {isAdmin && (
                      <Menu
                        placement="bottom-end"
                        trigger={({ ref, getProps }) => <IconButton ref={ref} icon={<MoreHorizontal />} label={t.common.more} size="sm" {...getProps()} />}
                        items={[
                          { key: 'edit', label: t.common.edit, icon: <Pencil />, onSelect: () => setEditing(member) },
                          {
                            key: 'active',
                            label: member.active ? t.members.deactivate : t.members.activate,
                            icon: <Power />,
                            onSelect: () => update.mutate({ userId: member.userId, active: !member.active }),
                          },
                          'separator',
                          { key: 'remove', label: t.members.remove, icon: <Trash2 />, danger: true, onSelect: () => void removeMember(member) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isAdmin && <PendingInvites />}
      </div>
      {editing && <MemberDialog member={editing} onClose={() => setEditing(null)} />}
      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
    </>
  );
}
