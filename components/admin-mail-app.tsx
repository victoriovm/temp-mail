"use client"

import {
  Inbox,
  MailOpen,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { MailReadingPane } from "@/components/mail-reading-pane"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  formatReceivedTime,
  haveSameMessageSummaries,
} from "@/lib/mail-display"
import type {
  MailContent,
  MessageSummary,
  StoredMessage,
} from "@/lib/mail-types"
import { cn } from "@/lib/utils"

interface AdminMessageSummary extends MessageSummary {
  mailbox: string
  recipient?: MailContent["to"]
}

function recipientLabel(
  recipient: MailContent["to"] | undefined,
  mailbox: string,
) {
  if (Array.isArray(recipient)) {
    const values = recipient.filter(Boolean)
    if (values.length > 0) return values.join(", ")
  }

  if (typeof recipient === "string" && recipient.trim()) {
    return recipient
  }

  return mailbox
}

function InboxSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {[0, 1, 2, 3, 4].map((item) => (
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
      <h3 className="font-semibold">Nenhuma mensagem no sistema</h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
        As mensagens recebidas por qualquer caixa aparecerão aqui.
      </p>
    </div>
  )
}

export function AdminMailApp({ token }: { token: string }) {
  const [messages, setMessages] = useState<AdminMessageSummary[]>([])
  const [selected, setSelected] = useState<AdminMessageSummary | null>(null)
  const [selectedMessage, setSelectedMessage] = useState<StoredMessage | null>(
    null,
  )
  const [loadingInbox, setLoadingInbox] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const inboxRequest = useRef<AbortController | null>(null)
  const encodedToken = encodeURIComponent(token)

  const loadMessages = useCallback(
    async (silent = false) => {
      if (inboxRequest.current) {
        setRefreshing(false)
        return
      }

      const controller = new AbortController()
      inboxRequest.current = controller

      if (!silent) setLoadingInbox(true)

      try {
        const response = await fetch(`/api/admin/${encodedToken}/list`, {
          cache: "no-store",
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "Acesso administrativo inválido."
              : "Não foi possível carregar as mensagens.",
          )
        }

        const data = (await response.json()) as {
          messages?: AdminMessageSummary[]
        }
        const nextMessages = Array.isArray(data.messages) ? data.messages : []
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
            error instanceof Error
              ? error.message
              : "Erro ao carregar as mensagens.",
          )
        }
      } finally {
        if (inboxRequest.current === controller) {
          inboxRequest.current = null
          setLoadingInbox(false)
          setRefreshing(false)
        }
      }
    },
    [encodedToken],
  )

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadMessages()
    }, 0)
    const interval = window.setInterval(() => {
      void loadMessages(true)
    }, 3_000)

    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
      inboxRequest.current?.abort()
      inboxRequest.current = null
    }
  }, [loadMessages])

  async function openMessage(summary: AdminMessageSummary) {
    setSelected(summary)
    setLoadingMessage(true)

    try {
      const response = await fetch(`/api/admin/${encodedToken}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailbox: summary.mailbox,
          id: summary.id,
        }),
        cache: "no-store",
      })

      if (!response.ok) throw new Error("Mensagem não encontrada.")

      const data = (await response.json()) as {
        mailbox: string
        message: StoredMessage
      }
      setSelectedMessage(data.message)
    } catch (error) {
      setSelected(null)
      setSelectedMessage(null)
      toast.error(
        error instanceof Error ? error.message : "Erro ao abrir a mensagem.",
      )
    } finally {
      setLoadingMessage(false)
    }
  }

  function refreshInbox() {
    setRefreshing(true)
    void loadMessages(true)
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-muted/20">
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6">
        <Card className="shrink-0 gap-0 p-0">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-5">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl border bg-muted/50">
              <ShieldCheck className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-base">
                Mensagens do sistema
              </h1>
              <p className="text-xs text-muted-foreground">
                Todas as caixas temporárias
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto rounded-full">
              {messages.length}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10 rounded-xl"
                  onClick={refreshInbox}
                  disabled={refreshing}
                  aria-label="Atualizar todas as mensagens"
                >
                  <RefreshCw className={cn(refreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar mensagens</TooltipContent>
            </Tooltip>
          </div>
        </Card>

        <Card className="mt-4 grid min-h-0 flex-1 gap-0 overflow-hidden p-0 md:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.5fr)]">
          <div
            className={cn(
              "min-h-0 min-w-0 flex-col border-r-0 md:flex md:border-r",
              selected ? "hidden" : "flex",
            )}
          >
            <div className="flex h-14 shrink-0 items-center border-b px-4">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="grid size-7 place-items-center rounded-md border bg-muted/40">
                  <Inbox className="size-3.5" />
                </span>
                Todos os e-mails
              </span>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              {loadingInbox ? (
                <InboxSkeleton />
              ) : messages.length === 0 ? (
                <EmptyInbox />
              ) : (
                <div className="space-y-1 p-2">
                  {messages.map((message) => (
                    <button
                      key={`${message.mailbox}:${message.id}`}
                      type="button"
                      onClick={() => void openMessage(message)}
                      className={cn(
                        "group w-full overflow-hidden rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected?.id === message.id &&
                          selected.mailbox === message.mailbox &&
                          "bg-primary/7",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                          <UserRound className="size-4" />
                        </div>
                        <div className="w-0 min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <p className="min-w-0 max-w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold">
                              {message.sender || "Remetente desconhecido"}
                            </p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {formatReceivedTime(message.receivedAt)}
                            </span>
                          </div>
                          <p className="mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">
                            {message.title || "(sem assunto)"}
                          </p>
                          <p className="mt-1 block w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">
                            Para: {recipientLabel(message.recipient, message.mailbox)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div
            className={cn(
              "h-full min-h-0 min-w-0",
              selected ? "block" : "hidden md:block",
            )}
          >
            <MailReadingPane
              emptyDescription="O conteúdo completo será exibido aqui."
              loading={loadingMessage}
              message={selectedMessage}
              mutedAvatar
              onBack={() => {
                setSelected(null)
                setSelectedMessage(null)
              }}
              subtitle={
                selectedMessage
                  ? `Caixa: ${recipientLabel(
                      selectedMessage.content.to,
                      selected?.mailbox ?? "",
                    )}`
                  : undefined
              }
            />
          </div>
        </Card>
      </main>
    </div>
  )
}
