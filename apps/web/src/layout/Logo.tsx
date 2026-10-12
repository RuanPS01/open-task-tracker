/** Marca do Open Task Tracker: relógio sobre círculo rosa (não reutiliza a marca do Toggl). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="var(--accent)" />
      <circle cx="16" cy="17" r="8.5" fill="none" stroke="var(--accent-contrast)" strokeWidth="2.6" />
      <path d="M16 11.5v5.5l3.5 2.2" fill="none" stroke="var(--accent-contrast)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 5.5h6" stroke="var(--accent-contrast)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
