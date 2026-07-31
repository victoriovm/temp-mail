import { isValidAdminToken } from "@/lib/admin-auth"
import { adminJson, adminNotFound } from "@/lib/admin-response"
import { normalizeMailbox } from "@/lib/mail-types"
import { readMessage } from "@/lib/mail-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ token: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params
  if (!isValidAdminToken(token)) return adminNotFound()

  const body = await request.json().catch(() => null)
  const mailbox = normalizeMailbox(body?.mailbox)
  const id = typeof body?.id === "string" ? body.id : null

  if (!mailbox || !id) {
    return adminJson({ error: "Mailbox and ID required." }, 400)
  }

  const message = await readMessage(mailbox, id)
  if (!message) return adminNotFound()

  return adminJson({ mailbox, message })
}
