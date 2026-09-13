import {
  isPasswordAuthorized,
  isPasswordRequired,
  passwordRequiredResponse,
} from "@/lib/api-auth"
import { apiJson, corsOptions } from "@/lib/api-response"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function OPTIONS() {
  return corsOptions()
}

export function POST(request: Request) {
  if (!isPasswordAuthorized(request)) return passwordRequiredResponse()

  return apiJson({ ok: true, required: isPasswordRequired() })
}