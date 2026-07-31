import { apiJson, corsOptions } from "@/lib/api-response"
import { normalizeMailbox } from "@/lib/mail-types"
import { readMessage } from "@/lib/mail-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS() {
  return corsOptions()
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const mailbox = normalizeMailbox(body?.email)
  const id = typeof body?.id === "string" ? body.id : null

  if (!mailbox || !id) {
    return apiJson({ error: "Email and ID required!" }, 400)
  }

  const message = await readMessage(mailbox, id)

  if (!message) {
    return apiJson({ error: "Message not found!" }, 404)
  }

  return apiJson(message)
}
