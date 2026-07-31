"use client"

import { ArrowLeft, Mail, UserRound } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatReceivedDate } from "@/lib/mail-display"
import { getSenderLabel, type StoredMessage } from "@/lib/mail-types"
import { cn } from "@/lib/utils"

function safeEmailDocument(html: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src http: https: data: cid:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; max-width: 100%; }
      body {
        margin: 0;
        padding: 24px;
        color: #252a27;
        background: #ffffff;
        font: 15px/1.65 Arial, Helvetica, sans-serif;
        overflow-wrap: anywhere;
      }
      a { color: #171717; }
      img { height: auto; }
      pre { white-space: pre-wrap; }
      blockquote {
        margin-left: 0;
        padding-left: 16px;
        border-left: 3px solid #d8dedb;
        color: #5d6661;
      }
    </style>
  </head>
  <body>${html}</body>
</html>`
}

type MailReadingPaneProps = {
  emptyDescription?: string
  loading: boolean
  message: StoredMessage | null
  mutedAvatar?: boolean
  onBack: () => void
  subtitle?: string
}

export function MailReadingPane({
  emptyDescription = "O conteúdo será exibido aqui.",
  loading,
  message,
  mutedAvatar = false,
  onBack,
  subtitle,
}: MailReadingPaneProps) {
  const htmlDocument = useMemo(
    () =>
      message?.content.html
        ? safeEmailDocument(message.content.html)
        : undefined,
    [message],
  )

  if (loading) {
    return (
      <div className="h-full p-5 md:p-7">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="mt-4 h-9 w-52 rounded-full" />
        <Separator className="my-6" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="mt-3 h-3.5 w-5/6" />
        <Skeleton className="mt-3 h-3.5 w-2/3" />
      </div>
    )
  }

  if (!message) {
    return (
      <div className="hidden h-full flex-col items-center justify-center p-10 text-center md:flex">
        <div className="mb-4 grid size-12 place-items-center rounded-xl border bg-muted/50 text-muted-foreground">
          <Mail className="size-5" />
        </div>
        <h3 className="font-semibold">Selecione uma mensagem</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {emptyDescription}
        </p>
      </div>
    )
  }

  return (
    <article className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b px-4 py-4 md:px-6 md:py-5">
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3">
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 md:hidden"
              onClick={onBack}
              aria-label="Voltar para as mensagens"
            >
              <ArrowLeft />
            </Button>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-snug tracking-tight">
              {message.content.subject}
            </h2>
            {subtitle && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <div
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full",
              mutedAvatar
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary",
            )}
          >
            <UserRound className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {getSenderLabel(message.content.from)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatReceivedDate(message.receivedAt)}
            </p>
          </div>
        </div>
      </div>

      {htmlDocument ? (
        <iframe
          title={`Mensagem: ${message.content.subject}`}
          srcDoc={htmlDocument}
          sandbox=""
          referrerPolicy="no-referrer"
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap p-5 text-sm leading-7 md:p-7">
          {message.content.text || "Esta mensagem não possui conteúdo visível."}
        </div>
      )}
    </article>
  )
}
