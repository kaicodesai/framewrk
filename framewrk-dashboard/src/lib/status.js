// Maps prospect/build status strings to a display label + accent color class.
// Kept in one place so new statuses (or a designer's opinion on color) only
// need to change here.

const DEFAULT = { label: 'unknown', color: 'muted' }

const MAP = {
  // prospect statuses
  submitted: { label: 'submitted', color: 'muted' },
  building: { label: 'building', color: 'info' },
  qa_pass: { label: 'qa pass', color: 'acid' },
  qa_fail: { label: 'qa fail', color: 'danger' },
  outreach_ready: { label: 'ready', color: 'acid' },
  sent: { label: 'sent', color: 'info' },
  interested: { label: 'interested', color: 'acid' },
  paid: { label: 'paid', color: 'acid' },
  handed_off: { label: 'handed off', color: 'acid' },
  closed_lost: { label: 'closed — lost', color: 'faint' },

  // build statuses
  queued: { label: 'queued', color: 'muted' },
  designing: { label: 'designing', color: 'info' },
  sourcing_assets: { label: 'sourcing assets', color: 'info' },
  generating: { label: 'generating', color: 'info' },
  awaiting_manual_build: { label: 'awaiting manual build', color: 'info' },
  qa_running: { label: 'qa running', color: 'info' },
  ready: { label: 'ready', color: 'acid' },
  failed: { label: 'failed', color: 'danger' },

  // job states
  pending: { label: 'pending', color: 'muted' },
  running: { label: 'running', color: 'info' },
  done: { label: 'done', color: 'acid' },
  error: { label: 'error', color: 'danger' },
}

export function statusInfo(status) {
  return MAP[status] ?? { ...DEFAULT, label: status ?? 'unknown' }
}

export const COLOR_CLASSES = {
  acid: { border: 'border-acid-text', text: 'text-acid-text' },
  info: { border: 'border-info', text: 'text-info' },
  danger: { border: 'border-danger', text: 'text-danger' },
  muted: { border: 'border-muted', text: 'text-muted' },
  faint: { border: 'border-faint', text: 'text-faint' },
}
