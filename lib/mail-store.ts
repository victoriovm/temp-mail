import Redis from "ioredis"

import {
  getMessageReceivedAt,
  normalizeContent,
  normalizeMailbox,
  normalizeReceivedAt,
  type StoredMessage,
} from "@/lib/mail-types"

export const EMAIL_TTL_SECONDS = 43_200
const MAX_MEMORY_MESSAGES = 100
const RECEIVED_AT_KEY_PREFIX = "temp-mail:received-at:"

type MemoryBucket = {
  expiresAt: number
  messages: StoredMessage[]
}

export type MailboxMessage = {
  mailbox: string
  message: StoredMessage
}

type MailGlobals = typeof globalThis & {
  __tempMailMemoryStore?: Map<string, MemoryBucket>
  __tempMailRedis?: Redis
}

const mailGlobals = globalThis as MailGlobals
const memoryStore =
  mailGlobals.__tempMailMemoryStore ?? new Map<string, MemoryBucket>()

if (process.env.NODE_ENV !== "production") {
  mailGlobals.__tempMailMemoryStore = memoryStore
}

function getMemoryBucket(mailbox: string): MemoryBucket | undefined {
  const bucket = memoryStore.get(mailbox)
  if (!bucket) return undefined

  if (bucket.expiresAt <= Date.now()) {
    memoryStore.delete(mailbox)
    return undefined
  }

  return bucket
}

function getRedisClient(): Redis | null {
  const url = process.env.REDIS_SERVER
  if (!url) return null

  if (!mailGlobals.__tempMailRedis) {
    const client = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 3_000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    })

    client.on("error", (error) => {
      console.error("[temp-mail] Redis indisponível:", error.message)
    })

    mailGlobals.__tempMailRedis = client
  }

  return mailGlobals.__tempMailRedis
}

async function readyRedis(): Promise<Redis | null> {
  const redis = getRedisClient()
  if (!redis) return null

  try {
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect()
    }
    return redis
  } catch {
    return null
  }
}

type ParsedMessages = {
  messages: StoredMessage[]
  timestamps: Record<string, string>
}

function receivedAtKey(mailbox: string) {
  return `${RECEIVED_AT_KEY_PREFIX}${mailbox}`
}

function newestReceivedAtFromTtl(ttl: number) {
  if (ttl < 0 || ttl > EMAIL_TTL_SECONDS) return undefined

  return new Date(
    Date.now() - (EMAIL_TTL_SECONDS - ttl) * 1_000,
  ).toISOString()
}

function fillMissingTimestamps(
  messages: StoredMessage[],
  newestReceivedAt?: string,
) {
  let index = 0

  while (index < messages.length) {
    if (messages[index].receivedAt) {
      index += 1
      continue
    }

    const start = index
    while (index < messages.length && !messages[index].receivedAt) {
      index += 1
    }

    const end = index
    const count = end - start
    const previousTime =
      start > 0 ? Date.parse(messages[start - 1].receivedAt ?? "") : NaN
    const nextTime =
      end < messages.length
        ? Date.parse(messages[end].receivedAt ?? "")
        : NaN
    const newestTime = Date.parse(newestReceivedAt ?? "")

    if (start === 0 && Number.isFinite(newestTime)) {
      const step =
        Number.isFinite(nextTime) && newestTime > nextTime
          ? (newestTime - nextTime) / count
          : 1_000

      for (let offset = 0; offset < count; offset += 1) {
        messages[start + offset].receivedAt = new Date(
          newestTime - step * offset,
        ).toISOString()
      }
      continue
    }

    if (Number.isFinite(previousTime)) {
      const step =
        Number.isFinite(nextTime) && previousTime > nextTime
          ? (previousTime - nextTime) / (count + 1)
          : 1_000

      for (let offset = 0; offset < count; offset += 1) {
        messages[start + offset].receivedAt = new Date(
          previousTime - step * (offset + 1),
        ).toISOString()
      }
      continue
    }

    if (Number.isFinite(nextTime)) {
      for (let offset = 0; offset < count; offset += 1) {
        messages[start + offset].receivedAt = new Date(
          nextTime + (count - offset) * 1_000,
        ).toISOString()
      }
      continue
    }

    const firstSeenAt = Date.now()
    for (let offset = 0; offset < count; offset += 1) {
      messages[start + offset].receivedAt = new Date(
        firstSeenAt - offset * 1_000,
      ).toISOString()
    }
  }
}

function parseMessages(
  values: string[],
  storedTimestamps: Record<string, string> = {},
  newestReceivedAt?: string,
): ParsedMessages {
  const messages = values.flatMap((value) => {
    try {
      const parsed = JSON.parse(value) as StoredMessage
      const content = normalizeContent(parsed?.content)
      const receivedAt =
        content && parsed?.id
          ? getMessageReceivedAt({ ...parsed, content }) ??
            normalizeReceivedAt(storedTimestamps[parsed.id])
          : undefined

      return parsed?.id && content
        ? [{ ...parsed, content, receivedAt }]
        : []
    } catch {
      return []
    }
  })

  fillMissingTimestamps(messages, newestReceivedAt)

  return {
    messages,
    timestamps: Object.fromEntries(
      messages.flatMap((message) =>
        message.receivedAt &&
        normalizeReceivedAt(storedTimestamps[message.id]) !== message.receivedAt
          ? [[message.id, message.receivedAt]]
          : [],
      ),
    ),
  }
}

function appendTimestampPersistence(
  pipeline: ReturnType<Redis["pipeline"]>,
  mailbox: string,
  timestamps: Record<string, string>,
  ttl: number,
) {
  const entries = Object.entries(timestamps)
  if (entries.length === 0) return

  pipeline.hset(receivedAtKey(mailbox), ...entries.flat())
  pipeline.expire(
    receivedAtKey(mailbox),
    ttl > 0 ? ttl : EMAIL_TTL_SECONDS,
  )
}

function sortMailboxMessages(messages: MailboxMessage[]) {
  return messages.sort((first, second) => {
    const firstTime = Date.parse(first.message.receivedAt ?? "")
    const secondTime = Date.parse(second.message.receivedAt ?? "")

    return (Number.isFinite(secondTime) ? secondTime : 0) -
      (Number.isFinite(firstTime) ? firstTime : 0)
  })
}

async function listRedisMessages(redis: Redis): Promise<MailboxMessage[]> {
  const keys = new Set<string>()
  let cursor = "0"

  do {
    const [nextCursor, batch] = await redis.scan(cursor, "COUNT", 250)
    cursor = nextCursor

    for (const key of batch) {
      if (normalizeMailbox(key) === key) keys.add(key)
    }
  } while (cursor !== "0")

  const mailboxes = [...keys]
  if (mailboxes.length === 0) return []

  const typePipeline = redis.pipeline()
  for (const mailbox of mailboxes) typePipeline.type(mailbox)

  const typeResults = await typePipeline.exec()
  const listMailboxes = mailboxes.filter(
    (_, index) => typeResults?.[index]?.[1] === "list",
  )
  if (listMailboxes.length === 0) return []

  const messagePipeline = redis.pipeline()
  for (const mailbox of listMailboxes) {
    messagePipeline.lrange(mailbox, 0, -1)
    messagePipeline.ttl(mailbox)
    messagePipeline.hgetall(receivedAtKey(mailbox))
  }

  const messageResults = await messagePipeline.exec()
  const timestampPipeline = redis.pipeline()
  const messages = listMailboxes.flatMap((mailbox, index) => {
    const valuesResult = messageResults?.[index * 3]
    const ttlResult = messageResults?.[index * 3 + 1]
    const timestampsResult = messageResults?.[index * 3 + 2]
    if (
      !valuesResult ||
      valuesResult[0] ||
      !Array.isArray(valuesResult[1])
    ) {
      return []
    }

    const ttl =
      typeof ttlResult?.[1] === "number" ? ttlResult[1] : EMAIL_TTL_SECONDS
    const storedTimestamps =
      timestampsResult?.[1] &&
      typeof timestampsResult[1] === "object" &&
      !Array.isArray(timestampsResult[1])
        ? (timestampsResult[1] as Record<string, string>)
        : {}
    const parsed = parseMessages(
      valuesResult[1] as string[],
      storedTimestamps,
      newestReceivedAtFromTtl(ttl),
    )

    appendTimestampPersistence(
      timestampPipeline,
      mailbox,
      parsed.timestamps,
      ttl,
    )

    return parsed.messages.map((message) => ({
      mailbox,
      message,
    }))
  })

  if (timestampPipeline.length > 0) await timestampPipeline.exec()

  return sortMailboxMessages(messages)
}

function listMemoryMessages(): MailboxMessage[] {
  const messages: MailboxMessage[] = []

  for (const mailbox of [...memoryStore.keys()]) {
    const bucket = getMemoryBucket(mailbox)
    if (!bucket) continue

    messages.push(
      ...bucket.messages.map((message) => ({
        mailbox,
        message,
      })),
    )
  }

  return sortMailboxMessages(messages)
}

export async function saveMessage(
  mailbox: string,
  message: StoredMessage,
): Promise<void> {
  const receivedAt =
    getMessageReceivedAt(message) ?? new Date().toISOString()
  const normalizedMessage = {
    ...message,
    content: {
      ...message.content,
      receivedAt,
    },
    receivedAt,
  }
  const redis = await readyRedis()

  if (redis) {
    try {
      await redis
        .multi()
        .lpush(mailbox, JSON.stringify(normalizedMessage))
        .expire(mailbox, EMAIL_TTL_SECONDS)
        .hset(receivedAtKey(mailbox), message.id, receivedAt)
        .expire(receivedAtKey(mailbox), EMAIL_TTL_SECONDS)
        .exec()
      return
    } catch (error) {
      console.error("[temp-mail] Falha ao gravar no Redis; usando memória.", error)
    }
  }

  const bucket = getMemoryBucket(mailbox)
  const messages = bucket?.messages ?? []
  messages.unshift(normalizedMessage)
  memoryStore.set(mailbox, {
    messages: messages.slice(0, MAX_MEMORY_MESSAGES),
    expiresAt: Date.now() + EMAIL_TTL_SECONDS * 1_000,
  })
}

export async function listMessages(mailbox: string): Promise<StoredMessage[]> {
  const redis = await readyRedis()

  if (redis) {
    try {
      const pipeline = redis.pipeline()
      pipeline.lrange(mailbox, 0, -1)
      pipeline.ttl(mailbox)
      pipeline.hgetall(receivedAtKey(mailbox))

      const results = await pipeline.exec()
      const values = Array.isArray(results?.[0]?.[1])
        ? (results[0][1] as string[])
        : []
      const ttl =
        typeof results?.[1]?.[1] === "number"
          ? results[1][1]
          : EMAIL_TTL_SECONDS
      const storedTimestamps =
        results?.[2]?.[1] &&
        typeof results[2][1] === "object" &&
        !Array.isArray(results[2][1])
          ? (results[2][1] as Record<string, string>)
          : {}
      const parsed = parseMessages(
        values,
        storedTimestamps,
        newestReceivedAtFromTtl(ttl),
      )
      const timestampPipeline = redis.pipeline()

      appendTimestampPersistence(
        timestampPipeline,
        mailbox,
        parsed.timestamps,
        ttl,
      )
      if (timestampPipeline.length > 0) await timestampPipeline.exec()

      return parsed.messages
    } catch (error) {
      console.error("[temp-mail] Falha ao ler o Redis; usando memória.", error)
    }
  }

  return getMemoryBucket(mailbox)?.messages ?? []
}

export async function readMessage(
  mailbox: string,
  id: string,
): Promise<StoredMessage | undefined> {
  const messages = await listMessages(mailbox)
  return messages.find((message) => message.id === id)
}

export async function listAllMessages(): Promise<MailboxMessage[]> {
  const redis = await readyRedis()

  if (redis) {
    try {
      return await listRedisMessages(redis)
    } catch (error) {
      console.error(
        "[temp-mail] Falha ao listar o Redis; usando memória.",
        error,
      )
    }
  }

  return listMemoryMessages()
}
