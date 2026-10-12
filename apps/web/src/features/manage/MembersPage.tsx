// Membros do workspace: função, capacidade semanal (usada na Linha do tempo) e
// valor/hora (usado nos relatórios). Só administradores alteram.
import type { AddMemberResponse, Member, MemberRole } from '@ott/shared';
import clsx from 'clsx';
import { Copy, MoreHorizontal, Pencil, Power, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAddMember, useMembers, useRemoveMember, useUpdateMember } from '../../api/workspace';
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

function MemberDialog({ member, onClose }: { member?: Member; onClose: () => void }) {
  const t = useT();
  const workspace = useWorkspace();
  const add = useAddMember();
  const update = useUpdateMember();
  const [name, setName] = useState(member?.name ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [role, setRole] = useState<MemberRole>(member?.role ?? 'member');
  const [capacity, setCapacity] = useState(String(member?.weeklyCapacityHours ?? 40));
  const [rate, setRate] = useState(member?.hourlyRate?.toString() ?? '');
  const [created, setCreated] = useState<AddMemberResponse | null>(null);

  const submit = () => {
    const weeklyCapacityHours = Number.parseFloat(capacity.replace(',', '.'));
    const hourlyRate = rate.trim() ? Number.parseFloat(rate.replace(',', '.')) : null;
    const common = {
      role,
      weeklyCapacityHours: Number.isFinite(weeklyCapacityHours) ? weeklyCapacityHours : 40,
      hourlyRate: hourlyRate !== null && Number.isFinite(hourlyRate) ? hourlyRate : null,
    };
    if (member) {
      update.mutate({ userId: member.userId, ...common }, { onSuccess: onClose });
    } else {
      add.mutate(
        { name: name.trim(), email: email.trim(), ...common },
        {
          onSuccess: (result) => {
            if (result.temporaryPassword) setCreated(result);
            else {
              toast.success(t.members.addedExisting);
              onClose();
            }
          },
        },
      );
    }
  };

  if (created) {
    return (
      <Modal
        open
        onClose={onClose}
        title={t.members.tempPasswordTitle}
        width={440}
        footer={
          <Button variant="primary" onClick={onClose}>
            {t.common.close}
          </Button>
        }
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{t.members.tempPasswordText}</p>
        <div className={styles.password}>
          <span>{created.member.email}</span>
        </div>
        <div className={styles.password}>
          <code>{created.temporaryPassword}</code>
          <IconButton
            icon={<Copy />}
            label={t.common.copy}
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(created.temporaryPassword ?? '');
              toast.success(t.common.copied);
            }}
          />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      persistent
      title={member ? t.members.edit : t.members.add}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="primary" onClick={submit} loading={add.isPending || update.isPending} disabled={!member && (!name.trim() || !email.trim())}>
            {member ? t.common.save : t.common.add}
          </Button>
        </>
      }
    >
      {!member && (
        <>
          <Field label={t.members.name}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
          <Field label={t.members.email}>{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        </>
      )}
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
    </Modal>
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
  const [dialog, setDialog] = useState<{ member?: Member } | null>(null);

  useEffect(() => {
    if (params.get('add') && isAdmin) {
      setDialog({});
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
            <Button variant="primary" icon={<UserPlus />} onClick={() => setDialog({})}>
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
                          { key: 'edit', label: t.common.edit, icon: <Pencil />, onSelect: () => setDialog({ member }) },
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
      </div>
      {dialog && <MemberDialog member={dialog.member} onClose={() => setDialog(null)} />}
    </>
  );
}
