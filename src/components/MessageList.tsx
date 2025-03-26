
import { useEffect, useState } from "react";
import { Message } from "@/lib/api";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, Mail } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  onSelectMessage: (message: Message) => void;
  selectedMessageId: string | null;
  className?: string;
}

export function MessageList({ 
  messages, 
  onSelectMessage, 
  selectedMessageId,
  className 
}: MessageListProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="space-y-1 p-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            {mounted ? "Nenhuma mensagem encontrada" : "Carregando..."}
          </div>
        ) : (
          messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <button
                onClick={() => onSelectMessage(message)}
                className={cn(
                  "flex w-full items-center text-left px-4 py-3 rounded-lg transition-all duration-200",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedMessageId === message.id
                    ? "bg-accent/80 text-accent-foreground font-medium"
                    : "text-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <Mail className="mr-3 h-4 w-4 flex-shrink-0" />
                <div className="flex-1 truncate">
                  <p className="truncate font-medium">{message.title}</p>
                </div>
                <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground" />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
