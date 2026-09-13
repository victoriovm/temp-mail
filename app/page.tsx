import { PasswordGate } from "@/components/password-gate"
import { TempMailApp } from "@/components/temp-mail-app"
import { isPasswordRequired } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

export default function Home() {
  return (
    <PasswordGate passwordRequired={isPasswordRequired()}>
      <TempMailApp />
    </PasswordGate>
  )
}
