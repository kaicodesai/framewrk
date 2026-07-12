import { statusInfo, COLOR_CLASSES } from '../lib/status'

export default function StatusBadge({ status }) {
  const { label, color } = statusInfo(status)
  const classes = COLOR_CLASSES[color] ?? COLOR_CLASSES.muted

  return (
    <span
      className={`inline-flex items-center gap-2 border-l-2 pl-2 pr-1 py-0.5 font-mono text-[11px] uppercase tracking-wider ${classes.border} ${classes.text}`}
    >
      {label}
    </span>
  )
}
