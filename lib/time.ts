/** Returns ISO string for 20 minutes ago (for ephemeral filtering). */
export function twentyMinutesAgoISO(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - 20)
  return d.toISOString()
}

/** Whether the given ISO string is within the last N minutes. */
export function isWithinMinutes(isoString: string, minutes: number): boolean {
  const date = new Date(isoString)
  const cutoff = new Date()
  cutoff.setMinutes(cutoff.getMinutes() - minutes)
  return date >= cutoff
}

/** Format ISO string as relative time (e.g. "2 min ago"). */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)

  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}
