"use client"

import {
  AtSign,
  Copy,
  Inbox,
  MailOpen,
  RefreshCw,
  Share2,
  Shuffle,
  UserRound,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from "unique-names-generator"

import { MailReadingPane } from "@/components/mail-reading-pane"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getStoredValue } from "@/lib/browser-storage"
import {
  formatReceivedTime,
  haveSameMessageSummaries,
} from "@/lib/mail-display"
import { getMailDomains, isValidDomain } from "@/lib/mail-domains"
import type { MessageSummary, StoredMessage } from "@/lib/mail-types"
import {
  getCachedReadIds,
  setCachedReadIds,
} from "@/lib/read-message-cache"
import { cn } from "@/lib/utils"

const MAIL_DOMAINS = getMailDomains()

const MAILBOX_STORAGE_KEY = "temp-mail:mailbox"
const DOMAIN_STORAGE_KEY = "temp-mail:domain"
const mailboxNumbers = Array.from({ length: 9000 }, (_, index) =>
  String(index + 100),
)

function randomIndex(max: number) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    return values[0] % max
  }

  return Math.floor(Math.random() * max)
}

function createMailboxName() {
  const seed =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint32Array(1))[0]
      : Date.now() + Math.floor(Math.random() * 1_000_000)

  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals, mailboxNumbers],
    length: 3,
    seed,
    separator: "-",
    style: "lowerCase",
  })
}

function randomDomain(current?: string) {
  if (MAIL_DOMAINS.length === 1) return MAIL_DOMAINS[0]

  const available = current
    ? MAIL_DOMAINS.filter((domain) => domain !== current)
    : MAIL_DOMAINS

  return available[randomIndex(available.length)]
}

function isValidMailbox(value: string) {
  return /^[a-z0-9][a-z0-9._-]{1,63}$/.test(value)
}

function parseSharedEmail(value: string | null) {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  const separator = normalized.lastIndexOf("@")

  if (separator <= 0 || separator === normalized.length - 1) return null

  const mailbox = normalized.slice(0, separator)
  const domain = normalized.slice(separator + 1)

  if (!isValidMailbox(mailbox) || !isValidDomain(domain)) return null

  return { mailbox, domain }
}

async function copyText(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  textarea.remove()
}

function InboxSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex gap-3 rounded-xl p-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyInbox() {
  return (
    <div className="flex min-h-[390px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-2xl border bg-muted/50 text-muted-foreground">
        <MailOpen className="size-6" />
      </div>
      <h3 className="font-semibold">Nenhuma mensagem</h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
        As mensagens enviadas para o endereço acima aparecerão aqui.
      </p>
    </div>
  )
}

export function TempMailApp() {
  const [mailbox, setMailbox] = useState("")
  const [domain, setDomain] = useState(MAIL_DOMAINS[0])
  const [isSharedMailbox, setIsSharedMailbox] = useState(false)
  const [draftMailbox, setDraftMailbox] = useState("")
  const [ready, setReady] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<StoredMessage | null>(
    null,
  )
  const [loadingInbox, setLoadingInbox] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const knownIds = useRef<Set<string>>(new Set())
  const hasLoaded = useRef(false)
  const inboxRequest = useRef<{
    controller: AbortController
    target: string
  } | null>(null)

  const email = mailbox ? `${mailbox}@${domain}` : `••••••@${domain}`

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const sharedEmail = parseSharedEmail(
        new URLSearchParams(window.location.search).get("mail"),
      )

      if (sharedEmail) {
        setMailbox(sharedEmail.mailbox)
        setDomain(sharedEmail.domain)
        setDraftMailbox(sharedEmail.mailbox)
        setReadIds(getCachedReadIds(sharedEmail.mailbox))
        setIsSharedMailbox(true)
        setReady(true)
        return
      }

      const saved = getStoredValue(MAILBOX_STORAGE_KEY, "mailbox")
      const savedDomain = getStoredValue(DOMAIN_STORAGE_KEY, "domain")
      const initial =
        saved && isValidMailbox(saved) ? saved : createMailboxName()
      const initialDomain =
        savedDomain && MAIL_DOMAINS.includes(savedDomain)
          ? savedDomain
          : randomDomain()

      window.localStorage.setItem(MAILBOX_STORAGE_KEY, initial)
      window.localStorage.setItem(DOMAIN_STORAGE_KEY, initialDomain)
      setMailbox(initial)
      setDomain(initialDomain)
      setDraftMailbox(initial)
      setReadIds(getCachedReadIds(initial))
      setReady(true)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [])

  const loadMessages = useCallback(async (target: string, silent = false) => {
    if (!target) return

    if (inboxRequest.current?.target === target) {
      setRefreshing(false)
      return
    }

    inboxRequest.current?.controller.abort()
    const controller = new AbortController()
    inboxRequest.current = { controller, target }

    if (!silent) setLoadingInbox(true)

    try {
      const response = await fetch("/api/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
        cache: "no-store",
        signal: controller.signal,
      })

      if (!response.ok) throw new Error("Não foi possível atualizar a caixa.")

      const data = (await response.json()) as { messages?: MessageSummary[] }
      const nextMessages = Array.isArray(data.messages) ? data.messages : []

      if (
        silent &&
        hasLoaded.current &&
        nextMessages.some((message) => !knownIds.current.has(message.id))
      ) {
        toast.success("Nova mensagem recebida!", {
          position: "bottom-right",
        })
      }

      knownIds.current = new Set(
        nextMessages.map((message) => message.id),
      )
      hasLoaded.current = true
      setMessages((current) =>
        haveSameMessageSummaries(current, nextMessages)
          ? current
          : nextMessages,
      )
    } catch (error) {
      if (
        !silent &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        toast.error(
          error instanceof Error ? error.message : "Erro ao carregar mensagens.",
        )
      }
    } finally {
      if (inboxRequest.current?.controller === controller) {
        inboxRequest.current = null
        setLoadingInbox(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!ready || !mailbox) return

    hasLoaded.current = false
    knownIds.current = new Set()

    const initialLoad = window.setTimeout(() => {
      void loadMessages(mailbox)
    }, 0)

    const interval = window.setInterval(() => {
      void loadMessages(mailbox, true)
    }, 3_000)

    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
      if (inboxRequest.current?.target === mailbox) {
        inboxRequest.current.controller.abort()
        inboxRequest.current = null
      }
    }
  }, [loadMessages, mailbox, ready])

  function switchMailbox(nextMailbox: string, nextDomain = domain) {
    window.localStorage.setItem(MAILBOX_STORAGE_KEY, nextMailbox)
    window.localStorage.setItem(DOMAIN_STORAGE_KEY, nextDomain)

    const url = new URL(window.location.href)
    url.searchParams.delete("mail")
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)

    setMailbox(nextMailbox)
    setDomain(nextDomain)
    setIsSharedMailbox(false)
    setDraftMailbox(nextMailbox)
    setMessages([])
    setSelectedId(null)
    setSelectedMessage(null)
    setReadIds(getCachedReadIds(nextMailbox))
    setIsEditing(false)
  }

  function randomizeMailbox() {
    switchMailbox(createMailboxName(), randomDomain(domain))
    toast.success("Novo endereço criado!")
  }

  function saveCustomMailbox() {
    const normalized = draftMailbox.trim().toLowerCase()

    if (!isValidMailbox(normalized)) {
      setDraftMailbox(mailbox)
      setIsEditing(false)
      toast.error(
        "Use de 2 a 64 caracteres: letras, números, pontos, hífens ou _.",
      )
      return
    }

    if (normalized === mailbox) {
      setIsEditing(false)
      return
    }

    switchMailbox(normalized)
    toast.success("E-mail atualizado!", { position: "bottom-right" })
  }

  async function handleCopy() {
    try {
      await copyText(email)
      toast.success("Endereço copiado!")
    } catch {
      toast.error("Não foi possível copiar o endereço.")
    }
  }

  async function shareMailbox() {
    const url = new URL(window.location.href)
    url.search = ""
    url.hash = ""
    url.searchParams.set("mail", email)

    try {
      await copyText(url.toString())
      toast.success("Link de compartilhamento copiado!")
    } catch {
      toast.error("Não foi possível copiar o link.")
    }
  }

  async function openMessage(summary: MessageSummary) {
    setSelectedId(summary.id)
    setLoadingMessage(true)
    setReadIds((current) => {
      const next = new Set(current).add(summary.id)
      setCachedReadIds(mailbox, next)
      return next
    })

    try {
      const response = await fetch("/api/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mailbox, id: summary.id }),
        cache: "no-store",
      })

      if (!response.ok) throw new Error("Mensagem não encontrada.")
      setSelectedMessage((await response.json()) as StoredMessage)
    } catch (error) {
      setSelectedId(null)
      toast.error(
        error instanceof Error ? error.message : "Erro ao abrir a mensagem.",
      )
    } finally {
      setLoadingMessage(false)
    }
  }

  function refreshInbox() {
    setRefreshing(true)
    void loadMessages(mailbox, true)
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-muted/20">
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6">
        <Card className="shrink-0 gap-0 overflow-hidden p-0">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row">
              {isEditing ? (
                <div className="mail-field-editor flex h-12 w-full flex-none items-center rounded-xl border bg-background px-3.5 ring-2 ring-ring/20 sm:px-12 md:min-w-0 md:flex-1">
                  <Input
                    value={draftMailbox}
                    onChange={(event) =>
                      setDraftMailbox(
                        event.target.value
                          .split("@")[0]
                          .toLowerCase()
                          .replace(/[^a-z0-9._-]/g, ""),
                      )
                    }
                    onBlur={saveCustomMailbox}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur()
                      if (event.key === "Escape") {
                        setDraftMailbox(mailbox)
                        setIsEditing(false)
                      }
                    }}
                    maxLength={64}
                    autoFocus
                    aria-label="Nome personalizado da caixa"
                    className="h-full border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:ring-0 sm:text-base"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className={cn(
                    "mail-field-button relative flex h-12 w-full flex-none items-center justify-center rounded-xl border bg-muted/40 px-3.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:px-12 md:min-w-0 md:flex-1",
                    isSharedMailbox && "cursor-default",
                  )}
                  onClick={() => {
                    if (isSharedMailbox) return
                    setDraftMailbox(mailbox)
                    setIsEditing(true)
                  }}
                  data-shared={isSharedMailbox}
                  disabled={!ready}
                  aria-label={
                    isSharedMailbox
                      ? "Endereço de e-mail compartilhado"
                      : "Editar endereço de e-mail"
                  }
                >
                  <span className="absolute left-3.5 hidden size-8 place-items-center rounded-lg bg-primary/10 text-primary sm:grid">
                    <AtSign className="size-[18px]" />
                  </span>
                  {ready ? (
                    <span className="block w-full truncate text-center text-sm font-semibold sm:text-base">
                      {email}
                    </span>
                  ) : (
                    <Skeleton className="h-5 w-4/5" />
                  )}
                </button>
              )}

              <div className="grid grid-cols-4 gap-2 md:flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-full rounded-xl md:w-12"
                      onClick={handleCopy}
                      disabled={!ready}
                      aria-label="Copiar endereço"
                    >
                      <Copy />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar endereço</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-full rounded-xl md:w-12"
                      onClick={() => void shareMailbox()}
                      disabled={!ready}
                      aria-label="Copiar link da caixa de e-mail"
                    >
                      <Share2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copiar link da caixa</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-full rounded-xl md:w-12"
                      onClick={refreshInbox}
                      disabled={refreshing || !ready}
                      aria-label="Atualizar mensagens"
                    >
                      <RefreshCw className={cn(refreshing && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Atualizar mensagens</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="h-12 w-full rounded-xl md:w-12"
                      onClick={randomizeMailbox}
                      disabled={!ready}
                      aria-label="Gerar novo endereço"
                    >
                      <Shuffle />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Gerar novo endereço</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </Card>

        <Card className="mt-4 grid min-h-0 flex-1 gap-0 overflow-hidden p-0 md:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.5fr)]">
          <div
            className={cn(
              "min-h-0 min-w-0 flex-col border-r-0 md:flex md:border-r",
              selectedId ? "hidden" : "flex",
            )}
          >
            <div className="flex h-14 shrink-0 items-center border-b px-4">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="grid size-7 place-items-center rounded-md border bg-muted/40 text-primary">
                  <Inbox className="size-3.5" />
                </span>
                Caixa de Entrada
              </span>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              {loadingInbox ? (
                <InboxSkeleton />
              ) : messages.length === 0 ? (
                <EmptyInbox />
              ) : (
                <div className="space-y-1 p-2">
                  {messages.map((message) => {
                    const isRead = readIds.has(message.id)

                    return (
                      <button
                        key={message.id}
                        type="button"
                        onClick={() => void openMessage(message)}
                        className={cn(
                          "group relative w-full overflow-hidden rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selectedId === message.id && "bg-primary/7",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                            <UserRound className="size-4" />
                          </div>
                          <div className="w-0 min-w-0 flex-1 overflow-hidden">
                            <div className="flex items-center gap-2">
                              <p
                                className={cn(
                                  "min-w-0 max-w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs",
                                  isRead
                                    ? "text-muted-foreground"
                                    : "font-semibold",
                                )}
                              >
                                {message.sender || "Remetente desconhecido"}
                              </p>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {formatReceivedTime(message.receivedAt)}
                              </span>
                            </div>
                            <p
                              className={cn(
                                "mt-1 block w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm",
                                !isRead && "font-semibold",
                              )}
                            >
                              {message.title || "(sem assunto)"}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <div
            className={cn(
              "h-full min-h-0 min-w-0",
              selectedId ? "block" : "hidden md:block",
            )}
          >
            <MailReadingPane
              loading={loadingMessage}
              message={selectedMessage}
              onBack={() => {
                setSelectedId(null)
                setSelectedMessage(null)
              }}
            />
          </div>
        </Card>
      </main>
    </div>
  )
}
