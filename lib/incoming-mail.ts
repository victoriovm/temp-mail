import PostalMime, {
  type Address,
  type Attachment,
  type Email,
  type Mailbox,
} from "postal-mime"

import {
  normalizeContent,
  normalizeMailbox,
  type MailContent,
} from "@/lib/mail-types"

const MAX_RAW_EMAIL_BYTES = 10 * 1024 * 1024
const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024

export class IncomingMailError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

type IncomingBody = Record<string, unknown>

type NormalizedIncomingMail = {
  mailbox: string
  content: MailContent
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function looksLikeRawEmail(value: string) {
  const separator = value.search(/\r?\n\r?\n/)
  if (separator <= 0 || separator > 256 * 1024) return false

  const headers = value.slice(0, separator)
  const headerNames = new Set(
    [...headers.matchAll(/^([a-z0-9-]+)\s*:/gim)].map((match) =>
      match[1].toLowerCase(),
    ),
  )

  return (
    headerNames.has("from") &&
    (headerNames.has("to") ||
      headerNames.has("delivered-to") ||
      headerNames.has("subject") ||
      headerNames.has("mime-version") ||
      headerNames.has("content-type"))
  )
}

function rawEmailFromBody(body: IncomingBody) {
  if (typeof body.text === "string") return body.text
  if (typeof body.raw === "string") return body.raw
  if (typeof body.message === "string") return body.message

  if (
    isRecord(body.message) &&
    typeof body.message.text === "string" &&
    looksLikeRawEmail(body.message.text)
  ) {
    return body.message.text
  }

  return null
}

function flattenAddress(address: Address | undefined): Mailbox[] {
  if (!address) return []
  if ("group" in address && address.group) return address.group
  if ("address" in address && address.address) return [address as Mailbox]
  return []
}

function addressLabel(address: Address | undefined): MailContent["from"] {
  const mailbox = flattenAddress(address)[0]
  if (!mailbox) return undefined

  return {
    name: mailbox.name || undefined,
    address: mailbox.address || undefined,
  }
}

function recipientAddresses(email: Email) {
  return (email.to ?? [])
    .flatMap((address) => flattenAddress(address))
    .map((mailbox) => mailbox.address)
    .filter(Boolean)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function attachmentBase64(attachment: Attachment) {
  if (typeof attachment.content === "string") {
    return attachment.encoding === "base64"
      ? attachment.content.replace(/\s+/g, "")
      : Buffer.from(attachment.content, "utf8").toString("base64")
  }

  const bytes =
    attachment.content instanceof ArrayBuffer
      ? new Uint8Array(attachment.content)
      : attachment.content

  return Buffer.from(bytes).toString("base64")
}

function embedInlineImages(
  html: string | undefined,
  attachments: Attachment[],
) {
  if (!html) return undefined

  let embeddedHtml = html
  let embeddedBytes = 0

  for (const attachment of attachments) {
    const contentId = attachment.contentId?.replace(/^<|>$/g, "")
    if (!contentId || !attachment.mimeType.startsWith("image/")) continue

    const base64 = attachmentBase64(attachment)
    const byteLength = Math.ceil((base64.length * 3) / 4)
    if (
      byteLength <= 0 ||
      embeddedBytes + byteLength > MAX_INLINE_IMAGE_BYTES
    ) {
      continue
    }

    const dataUrl = `data:${attachment.mimeType};base64,${base64}`
    embeddedHtml = embeddedHtml.replace(
      new RegExp(`cid:${escapeRegExp(contentId)}`, "gi"),
      dataUrl,
    )
    embeddedBytes += byteLength
  }

  return embeddedHtml
}

function firstString(...values: unknown[]) {
  return values.find(
    (value): value is string => typeof value === "string" && Boolean(value.trim()),
  )
}

function parsedContent(
  email: Email,
  legacyMessage: Record<string, unknown> | null,
) {
  const recipients = recipientAddresses(email)
  const from = addressLabel(email.from)
  const html = embedInlineImages(email.html, email.attachments)

  return normalizeContent({
    subject:
      email.subject ??
      firstString(legacyMessage?.subject, "(sem assunto)"),
    from: from ?? legacyMessage?.from,
    to: recipients.length > 0 ? recipients : legacyMessage?.to,
    date: email.date ?? legacyMessage?.date,
    messageId: email.messageId,
    html,
    text: email.text,
  })
}

export async function normalizeIncomingMail(
  value: unknown,
): Promise<NormalizedIncomingMail | null> {
  if (!isRecord(value)) return null

  const rawEmail = rawEmailFromBody(value)
  const legacyMessage = isRecord(value.message) ? value.message : null

  if (!rawEmail) {
    const mailbox = normalizeMailbox(value.email ?? value.to)
    const content = normalizeContent(legacyMessage)
    return mailbox && content ? { mailbox, content } : null
  }

  if (Buffer.byteLength(rawEmail, "utf8") > MAX_RAW_EMAIL_BYTES) {
    throw new IncomingMailError("Raw email is too large.", 413)
  }

  let parsed: Email

  try {
    parsed = await PostalMime.parse(rawEmail, {
      attachmentEncoding: "base64",
      maxHeadersSize: 256 * 1024,
      maxNestingDepth: 30,
    })
  } catch {
    throw new IncomingMailError("Invalid raw email.")
  }

  const parsedRecipients = recipientAddresses(parsed)
  const mailbox = normalizeMailbox(
    firstString(
      value.email,
      value.to,
      parsed.deliveredTo,
      parsedRecipients[0],
    ),
  )
  const content = parsedContent(parsed, legacyMessage)

  return mailbox && content ? { mailbox, content } : null
}
