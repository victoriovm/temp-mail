import { isValidAdminToken } from "@/lib/admin-auth"
import { adminJson, adminNotFound } from "@/lib/admin-response"
import { listAllMessages } from "@/lib/mail-store"
import { toSummary } from "@/lib/mail-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ token: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params
  if (!isValidAdminToken(token)) return adminNotFound()

  const messages = (await listAllMessages()).map(({ mailbox, message }) => ({
    ...toSummary(message),
    mailbox,
    recipient: message.content.to,
  }))

  return adminJson({ messages })
}
