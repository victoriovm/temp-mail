import { apiJson, corsOptions } from "@/lib/api-response"
import { normalizeMailbox, toSummary } from "@/lib/mail-types"
import { listMessages } from "@/lib/mail-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS() {
  return corsOptions()
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const mailbox = normalizeMailbox(body?.email)

  if (!mailbox) {
    return apiJson({ error: "Email required!" }, 400)
  }

  const messages = await listMessages(mailbox)
  return apiJson({ messages: messages.map(toSummary) })
}
