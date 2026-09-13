"use client"

import { LoaderCircle, LockKeyhole } from "lucide-react"
import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  clearStoredPassword,
  getStoredPassword,
  storePassword,
  subscribeToUnauthorized,
} from "@/lib/api-client"

type GateStatus = "checking" | "locked" | "unlocked"
type PasswordCheck = "valid" | "invalid" | "error"

async function checkPassword(password: string): Promise<PasswordCheck> {
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { Authorization: `Bearer ${password}` },
      cache: "no-store",
    })

    if (response.ok) return "valid"
    if (response.status === 401) return "invalid"

    return "error"
  } catch {
    return "error"
  }
}

export function PasswordGate({
  passwordRequired,
  children,
}: {
  passwordRequired: boolean
  children: ReactNode
}) {
  const [status, setStatus] = useState<GateStatus>(
    passwordRequired ? "checking" : "unlocked",
  )
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!passwordRequired) return

    let active = true

    async function validateStoredPassword() {
      const storedPassword = getStoredPassword()

      if (!storedPassword) {
        if (active) setStatus("locked")
        return
      }

      const result = await checkPassword(storedPassword)
      if (!active) return

      if (result === "valid") {
        setStatus("unlocked")
        return
      }

      clearStoredPassword()
      setError(
        result === "error"
          ? "Não foi possível validar a senha salva."
          : "A senha salva não é mais válida.",
      )
      setStatus("locked")
    }

    void validateStoredPassword()

    return () => {
      active = false
    }
  }, [passwordRequired])

  useEffect(() => {
    if (!passwordRequired) return

    return subscribeToUnauthorized(() => {
      clearStoredPassword()
      setError("A senha não é mais válida. Informe novamente.")
      setStatus("locked")
    })
  }, [passwordRequired])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || password.length === 0) return

    setSubmitting(true)
    setError(null)

    const result = await checkPassword(password)

    if (result === "valid") {
      storePassword(password)
      setPassword("")
      setSubmitting(false)
      setStatus("unlocked")
      return
    }

    setError(
      result === "invalid"
        ? "Senha incorreta. Tente novamente."
        : "Não foi possível validar a senha.",
    )
    setSubmitting(false)
  }

  if (status === "unlocked") return <>{children}</>

  if (status === "checking") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-muted/20 text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        <p className="text-xs">Verificando acesso...</p>
      </div>
    )
  }

  return (
    <div className="flex h-dvh items-center justify-center bg-muted/20 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-gate-title"
        className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-muted/50 text-primary">
            <LockKeyhole className="size-5" />
          </div>
          <div className="min-w-0">
            <h1
              id="password-gate-title"
              className="text-lg font-semibold tracking-tight"
            >
              Acesso protegido
            </h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Informe a senha para ver as mensagens desta caixa.
            </p>
          </div>
        </div>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Senha"
            aria-label="Senha de acesso"
            aria-invalid={error ? true : undefined}
            autoComplete="current-password"
            autoFocus
            disabled={submitting}
            className="h-10"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || password.length === 0}
          >
            {submitting ? "Verificando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  )
}