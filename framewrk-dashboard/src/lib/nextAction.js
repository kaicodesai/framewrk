// Urgency classification for a prospect's next_action_date — drives the
// Pipeline "needs action" list and the color-coding on ProspectDetail.
function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = todayDateString()
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((Date.parse(dateStr) - Date.parse(today)) / msPerDay)
}

// 'overdue' | 'today' | 'upcoming' | null (no date set)
export function actionUrgency(dateStr) {
  const diff = daysUntil(dateStr)
  if (diff === null) return null
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  return 'upcoming'
}

export function actionDateLabel(dateStr) {
  const diff = daysUntil(dateStr)
  if (diff === null) return ''
  if (diff === 0) return 'due today'
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 1) return 'due tomorrow'
  return `due in ${diff}d`
}
