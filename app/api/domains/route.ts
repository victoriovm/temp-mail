import { guardPassword } from "@/lib/api-auth"
import { apiJson, corsOptions } from "@/lib/api-response"
import { getMailDomains } from "@/lib/mail-domains"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS() {
  return corsOptions()
}

export function GET(request: Request) {
  const unauthorized = guardPassword(request)
  if (unauthorized) return unauthorized

  return apiJson({ domains: getMailDomains() })
}
