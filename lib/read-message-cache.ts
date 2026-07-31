import { getStoredValue } from "@/lib/browser-storage"

const STORAGE_KEY = "temp-mail:read-messages"
const CACHE_TTL_MS = 43_200_000
const MAX_MAILBOXES = 50
const MAX_MESSAGE_IDS = 100

type CacheEntry = {
  ids: string[]
  updatedAt: number
}

type ReadMessagesCache = Record<string, CacheEntry>

function isValidMailbox(value: string) {
  return /^[a-z0-9][a-z0-9._-]{1,63}$/.test(value)
}

function loadCache(): ReadMessagesCache {
  try {
    const raw = getStoredValue(STORAGE_KEY, "read-messages")
    if (!raw) return {}

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}

    const expiration = Date.now() - CACHE_TTL_MS
    const entries: Array<[string, CacheEntry]> = []

    for (const [mailbox, value] of Object.entries(parsed)) {
      if (
        !isValidMailbox(mailbox) ||
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        continue
      }

      const entry = value as { ids?: unknown; updatedAt?: unknown }
      if (
        typeof entry.updatedAt !== "number" ||
        entry.updatedAt < expiration ||
        !Array.isArray(entry.ids)
      ) {
        continue
      }

      const ids = entry.ids
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .slice(-MAX_MESSAGE_IDS)

      entries.push([
        mailbox,
        { ids: [...new Set(ids)], updatedAt: entry.updatedAt },
      ])
    }

    return Object.fromEntries(
      entries
        .sort(([, first], [, second]) => second.updatedAt - first.updatedAt)
        .slice(0, MAX_MAILBOXES),
    )
  } catch {
    return {}
  }
}

export function getCachedReadIds(mailbox: string) {
  return new Set(loadCache()[mailbox]?.ids ?? [])
}

export function setCachedReadIds(mailbox: string, ids: Set<string>) {
  try {
    const cache = loadCache()
    cache[mailbox] = {
      ids: [...ids].slice(-MAX_MESSAGE_IDS),
      updatedAt: Date.now(),
    }

    const trimmedCache = Object.fromEntries(
      Object.entries(cache)
        .sort(([, first], [, second]) => second.updatedAt - first.updatedAt)
        .slice(0, MAX_MAILBOXES),
    )

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedCache))
  } catch {
    // A leitura continua funcionando se o storage estiver indisponível.
  }
}
