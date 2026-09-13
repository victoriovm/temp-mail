import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminMailApp } from "@/components/admin-mail-app"
import { PasswordGate } from "@/components/password-gate"
import { isValidAdminToken } from "@/lib/admin-auth"
import { isPasswordRequired } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Administração — Temp Mail",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  referrer: "no-referrer",
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!isValidAdminToken(token)) notFound()

  return (
    <PasswordGate passwordRequired={isPasswordRequired()}>
      <AdminMailApp token={token} />
    </PasswordGate>
  )
}
