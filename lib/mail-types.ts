export interface MailContent {
  subject: string
  html?: string
  text?: string
  from?: string | { address?: string; name?: string }
  to?: string | string[]
  date?: string
  [key: string]: unknown
}

export interface StoredMessage {
  id: string
  content: MailContent
  receivedAt?: string
}

export interface MessageSummary {
  id: string
  title: string
  sender: string
  receivedAt?: string
}

export function normalizeReceivedAt(value: unknown): string | undefined {
  let date: Date

  if (typeof value === "number" && Number.isFinite(value)) {
    date = new Date(value < 1_000_000_000_000 ? value * 1_000 : value)
  } else if (typeof value === "string" && value.trim()) {
    const numeric = Number(value)
    date =
      Number.isFinite(numeric) && /^\d+(?:\.\d+)?$/.test(value.trim())
        ? new Date(numeric < 1_000_000_000_000 ? numeric * 1_000 : numeric)
        : new Date(value)
  } else {
    return undefined
  }

  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

export function getMessageReceivedAt(
  message: Pick<StoredMessage, "content" | "receivedAt">,
) {
  const content = message.content as Record<string, unknown>
  const candidates = [
    message.receivedAt,
    content.receivedAt,
    content.timestamp,
    content.date,
  ]

  for (const candidate of candidates) {
    const normalized = normalizeReceivedAt(candidate)
    if (normalized) return normalized
  }

  return undefined
}

export function normalizeMailbox(value: unknown): string | null {
  if (typeof value !== "string") return null

  const localPart = value.trim().toLowerCase().split("@")[0]

  if (!localPart || !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(localPart)) {
    return null
  }

  return localPart
}

function decodeMimeBytes(bytes: Uint8Array, charset: string) {
  const normalizedCharset = charset.trim().toLowerCase()
  const encoding =
    normalizedCharset === "utf8"
      ? "utf-8"
      : normalizedCharset === "latin1"
        ? "windows-1252"
        : normalizedCharset

  try {
    return new TextDecoder(encoding).decode(bytes)
  } catch {
    return new TextDecoder("utf-8").decode(bytes)
  }
}

function decodeMimeWord(
  original: string,
  charset: string,
  transferEncoding: string,
  encodedText: string,
) {
  try {
    if (transferEncoding.toLowerCase() === "b") {
      return decodeMimeBytes(
        Buffer.from(encodedText.replace(/\s+/g, ""), "base64"),
        charset,
      )
    }

    const bytes: number[] = []

    for (let index = 0; index < encodedText.length; index += 1) {
      const character = encodedText[index]
      const hexadecimal = encodedText.slice(index + 1, index + 3)

      if (character === "_") {
        bytes.push(0x20)
      } else if (character === "=" && /^[a-f0-9]{2}$/i.test(hexadecimal)) {
        bytes.push(Number.parseInt(hexadecimal, 16))
        index += 2
      } else {
        bytes.push(character.charCodeAt(0) & 0xff)
      }
    }

    return decodeMimeBytes(Uint8Array.from(bytes), charset)
  } catch {
    return original
  }
}

function decodeMimeHeader(value: string) {
  const unfolded = value
    .replace(/\r?\n[ \t]+/g, " ")
    .replace(/(\?=)[ \t]+(?==\?)/g, "$1")

  const decoded = unfolded.replace(
    /=\?([^?\s]+)\?([bq])\?([^?]*)\?=/gi,
    decodeMimeWord,
  )

  return decoded
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function decodeBase64Layer(value: string): string | null {
  const dataUriMatch = value.match(
    /^data:(?:text\/html|text\/plain)(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i,
  )
  const encoded = (dataUriMatch?.[1] ?? value).trim().replace(/\s+/g, "")
  const hasStrongBase64Signal =
    encoded.length >= 12 || /=/.test(encoded) || /[+/_-]/.test(encoded)

  if (
    encoded.length < 4 ||
    !hasStrongBase64Signal ||
    encoded.length % 4 === 1 ||
    !/^[a-z0-9+/_-]*={0,2}$/i.test(encoded)
  ) {
    return null
  }

  try {
    const standardBase64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
    const bytes = Buffer.from(standardBase64, "base64")
    const canonicalInput = standardBase64.replace(/=+$/, "")
    const canonicalDecoded = bytes.toString("base64").replace(/=+$/, "")

    if (canonicalInput !== canonicalDecoded) return null

    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const hasUnsupportedControlCharacters =
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(decoded)

    return hasUnsupportedControlCharacters ? null : decoded
  } catch {
    return null
  }
}

function decodeBase64Content(value: string): string | null {
  let current = value
  let decoded: string | null = null

  for (let depth = 0; depth < 3; depth += 1) {
    const next = decodeBase64Layer(current)
    if (next === null) break

    decoded = next
    current = next
  }

  return decoded
}

function looksLikeHtml(value: string) {
  return /<!doctype\s+html\b|<html\b|<body\b|<\/?[a-z][^>]*>/i.test(value)
}

export function normalizeContent(value: unknown): MailContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const content = value as Record<string, unknown>
  const rawSubject =
    typeof content.subject === "string" ? content.subject.trim() : ""
  const subject = decodeMimeHeader(rawSubject) || "(sem assunto)"
  const html = typeof content.html === "string" ? content.html : undefined
  const text = typeof content.text === "string" ? content.text : undefined
  const decodedHtml = html ? decodeBase64Content(html) : null
  const decodedText = text ? decodeBase64Content(text) : null
  const textContainsHtml = decodedText ? looksLikeHtml(decodedText) : false

  return {
    ...content,
    subject,
    html:
      decodedHtml ||
      html ||
      (textContainsHtml ? decodedText ?? undefined : undefined),
    text: textContainsHtml ? undefined : decodedText || text,
  } as MailContent
}

export function getSenderLabel(from: MailContent["from"]): string {
  if (typeof from === "string") return from
  if (from && typeof from === "object") {
    if (from.name && from.address && from.name !== from.address) {
      return `${from.name} <${from.address}>`
    }

    return from.name || from.address || "Remetente desconhecido"
  }
  return "Remetente desconhecido"
}

export function toSummary(message: StoredMessage): MessageSummary {
  return {
    id: message.id,
    title: message.content.subject,
    sender: getSenderLabel(message.content.from),
    receivedAt: getMessageReceivedAt(message),
  }
}
