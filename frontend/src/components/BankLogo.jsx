export function BBMark({ size = 32 }) {
  const radius = Math.round(size * 0.28);
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: 'var(--text-primary)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: Math.round(size * 0.36),
        letterSpacing: '-0.06em',
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      BB
    </div>
  );
}

export function BankWatermark() {
  return (
    <div className="auth-page__watermark auth-page__watermark--bb" aria-hidden="true">
      BB
    </div>
  );
}

export default function BankLogo({ compact = false, hero = false }) {
  const markSize = hero ? 56 : compact ? 36 : 40;
  const nameSize = hero
    ? 'clamp(1.75rem, 4vw, 2.5rem)'
    : compact
      ? '0.95rem'
      : '1.15rem';

  return (
    <div
      className={hero ? 'bank-logo bank-logo--hero' : 'bank-logo'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: hero ? '0.85rem' : '0.55rem',
        color: 'var(--text-primary)',
      }}
      aria-label="Blink Bank"
    >
      <BBMark size={markSize} />
      <span
        style={{
          fontSize: nameSize,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
        }}
      >
        Blink Bank
      </span>
    </div>
  );
}
