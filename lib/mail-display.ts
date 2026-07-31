import type { MessageSummary } from "@/lib/mail-types"

type ComparableMessageSummary = MessageSummary & {
  mailbox?: string
}

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
})
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
})
const receivedDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function haveSameMessageSummaries(
  current: readonly ComparableMessageSummary[],
  next: readonly ComparableMessageSummary[],
) {
  return (
    current.length === next.length &&
    current.every((message, index) => {
      const nextMessage = next[index]

      return (
        message.id === nextMessage.id &&
        message.mailbox === nextMessage.mailbox &&
        message.title === nextMessage.title &&
        message.sender === nextMessage.sender &&
        message.receivedAt === nextMessage.receivedAt
      )
    })
  )
}

export function formatReceivedTime(value?: string) {
  if (!value) return "--:--"

  const receivedAt = new Date(value)
  if (!Number.isFinite(receivedAt.getTime())) return "--:--"

  const now = new Date()
  const time = timeFormatter.format(receivedAt)
  const isToday =
    receivedAt.getDate() === now.getDate() &&
    receivedAt.getMonth() === now.getMonth() &&
    receivedAt.getFullYear() === now.getFullYear()

  if (isToday) return time

  const date = shortDateFormatter.format(receivedAt)

  return `${date} ${time}`
}

export function formatReceivedDate(value?: string) {
  if (!value) return "Recebido recentemente"

  const receivedAt = new Date(value)
  if (!Number.isFinite(receivedAt.getTime())) return "Recebido recentemente"

  return receivedDateFormatter.format(receivedAt)
}
