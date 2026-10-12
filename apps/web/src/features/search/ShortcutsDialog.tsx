import { Modal } from '../../components/ui/Modal';
import { useT } from '../../i18n';

const ROWS = [
  { keys: ['S'], label: 'startStop' },
  { keys: ['N'], label: 'newTask' },
  { keys: ['Ctrl', 'K'], label: 'search' },
  { keys: ['?'], label: 'help' },
] as const;

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} title={t.shortcuts.title} width={420}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>{t.shortcuts[row.label]}</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>
                {row.keys.map((key) => (
                  <kbd
                    key={key}
                    style={{
                      marginLeft: 4,
                      padding: '2px 7px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'var(--bg-muted)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                    }}
                  >
                    {key}
                  </kbd>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
