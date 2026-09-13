import { isValidAdminToken } from "@/lib/admin-auth"
import { guardPassword } from "@/lib/api-auth"
import { adminJson, adminNotFound } from "@/lib/admin-response"
import { listAllMessages } from "@/lib/mail-store"
import { toSummary } from "@/lib/mail-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ token: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const unauthorized = guardPassword(request, () =>
    adminJson({ error: "Senha inválida ou ausente.", required: true }, 401),
  )
  if (unauthorized) return unauthorized

  const { token } = await context.params
  if (!isValidAdminToken(token)) return adminNotFound()

  const messages = (await listAllMessages()).map(({ mailbox, message }) => ({
    ...toSummary(message),
    mailbox,
    recipient: message.content.to,
  }))

  return adminJson({ messages })
}
