import { timingSafeEqual } from "node:crypto"

import { apiJson } from "@/lib/api-response"

export function getRequiredPassword() {
  const password = process.env.PASSWORD?.trim()

  return password ? password : null
}

export function isPasswordRequired() {
  return getRequiredPassword() !== null
}

function safeEquals(candidate: string, expected: string) {
  const candidateBytes = Buffer.from(candidate)
  const expectedBytes = Buffer.from(expected)

  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  )
}

export function readBearerToken(request: Request) {
  const header = request.headers.get("authorization")
  if (!header) return null

  const match = /^bearer\s+(.+)$/i.exec(header.trim())

  return match?.[1]?.trim() || null
}

export function hasValidPassword(request: Request) {
  const password = getRequiredPassword()
  if (!password) return false

  const token = readBearerToken(request)

  return token !== null && safeEquals(token, password)
}

export function hasValidSecretKey(request: Request) {
  const secret = process.env.SECRET_KEY?.trim()
  if (!secret) return false

  const token = readBearerToken(request)

  return token !== null && safeEquals(token, secret)
}

/**
 * Sem PASSWORD configurada, nenhuma rota exige autenticação.
 */
export function isPasswordAuthorized(request: Request) {
  return getRequiredPassword() === null || hasValidPassword(request)
}

export function passwordRequiredResponse() {
  return apiJson({ error: "Senha inválida ou ausente.", required: true }, 401)
}

/**
 * Devolve uma resposta 401 quando a senha está configurada e não confere.
 * Caso contrário, devolve null e a rota segue normalmente.
 */
export function guardPassword(
  request: Request,
  respond: () => Response = passwordRequiredResponse,
) {
  return isPasswordAuthorized(request) ? null : respond()
}