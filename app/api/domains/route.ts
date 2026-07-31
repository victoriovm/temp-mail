import { apiJson, corsOptions } from "@/lib/api-response"
import { getMailDomains } from "@/lib/mail-domains"

export const dynamic = "force-dynamic"

export function OPTIONS() {
  return corsOptions()
}

export function GET() {
  return apiJson({ domains: getMailDomains() })
}
