import { NextResponse } from "next/server"

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
}

export function adminJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateHeaders })
}

export function adminNotFound() {
  return adminJson({ error: "Not found." }, 404)
}
