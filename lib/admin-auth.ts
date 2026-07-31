import { timingSafeEqual } from "node:crypto"

export function isValidAdminToken(candidate: unknown): candidate is string {
  const expected = process.env.SECRET_KEY
  if (!expected || typeof candidate !== "string") return false

  const candidateBytes = Buffer.from(candidate)
  const expectedBytes = Buffer.from(expected)

  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  )
}
