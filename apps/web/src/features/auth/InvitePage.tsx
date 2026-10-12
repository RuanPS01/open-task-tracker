// Página aberta pelo link de convite (/invite/:workspaceId/:inviteId). A pessoa já
// está logada (RequireLogin): mostra o workspace e o papel, e entra ao aceitar.
import { useNavigate, useParams } from 'react-router-dom';
import { useAcceptInvite, useInvite } from '../../data/workspace';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingBlock } from '../../components/ui/EmptyState';
import { toast } from '../../components/ui/Toast';
import { useT } from '../../i18n';
import { useErrorMessage } from '../../lib/format';
import styles from './InvitePage.module.css';

export function InvitePage() {
  const t = useT();
  const navigate = useNavigate();
  const errorMessage = useErrorMessage();
  const { workspaceId = '', inviteId = '' } = useParams();
  const { data: invite, isLoading, error } = useInvite(workspaceId, inviteId);
  const accept = useAcceptInvite();

  if (isLoading) return <LoadingBlock />;

  return (
    <div className={styles.page}>
      {invite ? (
        <EmptyState
          illustration="people"
          title={t.invite.title}
          text={t.invite.text(invite.workspaceName, (invite.role === 'admin' ? t.members.admin : t.members.member).toLowerCase())}
          action={
            <div className={styles.actions}>
              <Button variant="ghost" onClick={() => navigate('/timer')}>
                {t.invite.decline}
              </Button>
              <Button
                variant="primary"
                loading={accept.isPending}
                onClick={() =>
                  accept.mutate(
                    { workspaceId, inviteId },
                    {
                      onSuccess: () => {
                        toast.success(t.invite.joined);
                        navigate('/timer', { replace: true });
                      },
                    },
                  )
                }
              >
                {t.invite.accept}
              </Button>
            </div>
          }
        />
      ) : (
        <EmptyState
          illustration="people"
          title={t.invite.title}
          text={error ? errorMessage(error) : t.invite.notFound}
          action={<Button onClick={() => navigate('/timer')}>{t.common.close}</Button>}
        />
      )}
    </div>
  );
}
