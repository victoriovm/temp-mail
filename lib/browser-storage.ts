export function getStoredValue(key: string, legacySuffix?: string) {
  const current = window.localStorage.getItem(key)
  if (current !== null || !legacySuffix) return current

  const suffix = `:${legacySuffix}`

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const candidateKey = window.localStorage.key(index)
    if (
      !candidateKey ||
      candidateKey === key ||
      !candidateKey.endsWith(suffix)
    ) {
      continue
    }

    const value = window.localStorage.getItem(candidateKey)
    if (value === null) continue

    window.localStorage.setItem(key, value)
    return value
  }

  return null
}
