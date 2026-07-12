const VARIANTS = {
  primary: 'bg-acid text-ink hover:bg-acid-dim disabled:bg-faint disabled:text-muted',
  ghost: 'bg-transparent text-ink border border-line hover:border-acid-text hover:text-acid-text disabled:text-faint disabled:border-line',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger hover:text-paper disabled:opacity-40',
}

export default function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button
      className={`px-4 py-2.5 font-mono text-xs uppercase tracking-widest2 transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
