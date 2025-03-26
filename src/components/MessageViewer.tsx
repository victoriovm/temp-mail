
import { MessageContent } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MessageViewerProps {
  messageContent: MessageContent | null;
  loading: boolean;
  className?: string;
}

export function MessageViewer({ messageContent, loading, className }: MessageViewerProps) {
  const decodeBase64Text = (text: string): string => {
    try {
      const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));

      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      return new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
      console.error("Error decoding base64:", error);
      return "Erro ao decodificar a mensagem";
    }
  };

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm h-full flex flex-col", className)}>
      {loading ? (
        <div className="p-4 space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !messageContent ? (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Selecione uma mensagem para visualizar
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-muted/50">
            <div className="mb-3 text-lg font-medium">
              {messageContent.content.subject || "Sem assunto"}
            </div>
            <div className="flex items-center text-sm">
              <span className="font-medium text-muted-foreground mr-1">De:</span>
              <span>{messageContent.content.from}</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: decodeBase64Text(messageContent.content.text) }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
