export function BankIcon({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="14" width="24" height="14" rx="3" fill="currentColor" opacity="0.9" />
      <path
        d="M6 14L16 6L26 14"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="14" y="18" width="4" height="10" rx="1" fill="#e2f0eb" />
    </svg>
  );
}

export function BankWatermark({ size = 200 }) {
  return (
    <div className="auth-page__watermark" aria-hidden="true">
      <BankIcon size={size} />
    </div>
  );
}

export default function BankLogo({ compact = false, hero = false }) {
  const iconSize = hero ? 52 : compact ? 22 : 32;
  const fontSize = hero ? 'clamp(2rem, 5vw, 2.75rem)' : compact ? '0.95rem' : '1.2rem';

  return (
    <div
      className={hero ? 'bank-logo bank-logo--hero' : 'bank-logo'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: hero ? '0.75rem' : '0.5rem',
        color: 'var(--text-primary)',
      }}
    >
      <BankIcon size={iconSize} />
      <span
        style={{
          fontSize,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
        }}
      >
        vibe.bank//
      </span>
    </div>
  );
}
