import { apiJson, corsOptions } from "@/lib/api-response"
import {
  IncomingMailError,
  normalizeIncomingMail,
} from "@/lib/incoming-mail"
import { saveMessage } from "@/lib/mail-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS() {
  return corsOptions()
}

export async function POST(request: Request) {
  const secret = process.env.SECRET_KEY
  const authorization = request.headers.get("authorization")

  if (!secret) {
    return apiJson({ error: "Receive endpoint is not configured!" }, 503)
  }

  if (!authorization || authorization !== `Bearer ${secret}`) {
    return apiJson({ error: "Access Denied" }, 403)
  }

  const contentLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > 11 * 1024 * 1024) {
    return apiJson({ error: "Request is too large." }, 413)
  }

  const requestBody = await request.text().catch(() => null)
  if (requestBody === null) {
    return apiJson({ error: "Unable to read email." }, 400)
  }

  const contentType = request.headers.get("content-type") ?? ""
  const envelopeTo =
    request.headers.get("x-envelope-to") ??
    new URL(request.url).searchParams.get("email")
  let body: unknown = {
    email: envelopeTo,
    text: requestBody,
  }

  if (
    contentType.includes("application/json") ||
    requestBody.trimStart().startsWith("{")
  ) {
    try {
      body = JSON.parse(requestBody)
    } catch {
      // Alguns serviços marcam o MIME raw incorretamente como JSON.
      // Nesse caso, o corpo ainda deve ser interpretado como RFC822.
    }
  }

  let incoming

  try {
    incoming = await normalizeIncomingMail(body)
  } catch (error) {
    if (error instanceof IncomingMailError) {
      return apiJson({ error: error.message }, error.status)
    }

    return apiJson({ error: "Unable to parse email." }, 400)
  }

  if (!incoming) {
    return apiJson({ error: "Email and message required!" }, 400)
  }

  const receivedAt = new Date().toISOString()
  const message = {
    id: crypto.randomUUID(),
    content: {
      ...incoming.content,
      receivedAt,
    },
    receivedAt,
  }

  await saveMessage(incoming.mailbox, message)
  return apiJson({ success: true, id: message.id, receivedAt })
}
