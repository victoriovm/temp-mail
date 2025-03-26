
import { useState, useEffect, useCallback } from "react";
import { Copy, RefreshCw, Inbox, Settings, MailPlus, ArrowRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MessageList } from "./MessageList";
import { MessageViewer } from "./MessageViewer";
import { ThemeToggle } from "./ThemeToggle";
import { Message, MessageContent, listMessages, readMessage } from "@/lib/api";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AVAILABLE_DOMAINS = (import.meta.env.EMAIL_DOMAINS || "tempmail.com,mailtemp.app,disposable.site").split(",");

function generateRandomEmail() {
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${randomStr}@${AVAILABLE_DOMAINS[0]}`;
}

export function EmailClient() {
  const [email, setEmail] = useState(() => {
    const savedEmail = localStorage.getItem("temp-mail-address");
    return savedEmail || generateRandomEmail();
  });
  const [customDomain, setCustomDomain] = useState(() => {
    return localStorage.getItem("custom-domain") || AVAILABLE_DOMAINS[0];
  });
  const [tempCustomDomain, setTempCustomDomain] = useState(customDomain);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState<MessageContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMessages, setFetchingMessages] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);
  const [editingUsername, setEditingUsername] = useState(false);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const emailParts = email.split('@');
  const username = emailParts[0];
  const domain = emailParts.length > 1 ? `@${emailParts[1]}` : `@${customDomain}`;

  const fetchMessages = useCallback(async () => {
    if (!email) return;

    setFetchingMessages(true);
    try {
      const data = await listMessages(email);
      setMessages(data);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Erro ao carregar mensagens");
    } finally {
      setFetchingMessages(false);
    }
  }, [email]);

  useEffect(() => {
    fetchMessages();
    const intervalId = setInterval(fetchMessages, 10000);
    return () => clearInterval(intervalId);
  }, [fetchMessages]);

  useEffect(() => {
    localStorage.setItem("temp-mail-address", email);
  }, [email]);

  useEffect(() => {
    localStorage.setItem("custom-domain", customDomain);
    setTempCustomDomain(customDomain);
  }, [customDomain]);

  const handleSelectMessage = async (message: Message) => {
    setSelectedMessageId(message.id);
    setLoading(true);
    if (isMobile) {
      setShowMobileList(false);
    }

    try {
      const data = await readMessage(email, message.id);
      setMessageContent(data);
    } catch (error) {
      console.error("Error fetching message content:", error);
      toast.error("Erro ao carregar conteúdo da mensagem");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(email);
    toast.success("Email copiado para a área de transferência!");
  };

  const handleGenerateNewEmail = () => {
    const newEmail = generateRandomEmail();
    setEmail(newEmail);
    setMessages([]);
    setSelectedMessageId(null);
    setMessageContent(null);
    toast.success("Novo email gerado!");
  };

  const handleRefresh = () => {
    fetchMessages();
    toast.success("Caixa de entrada atualizada!");
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value.trim();
    if (newUsername) {
      setEmail(`${newUsername}${domain}`);
    }
  };

  const toggleEditMode = () => {
    if (editingUsername) {
      fetchMessages();
    }
    setEditingUsername(!editingUsername);
  };

  const handleDomainChange = (value: string) => {
    setTempCustomDomain(value);
  };

  const handleSaveSettings = () => {
    if (tempCustomDomain) {
      setCustomDomain(tempCustomDomain);
      setEmail(`${username}@${tempCustomDomain}`);
      fetchMessages();
      toast.success("Configurações salvas!");
    }
  };

  const handleDialogOpen = (open: boolean) => {
    if (open) {
      setTempCustomDomain(customDomain);
    }
  };

  const handleBackToList = () => {
    setShowMobileList(true);
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b backdrop-blur-md bg-background/80 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            <h1 className="text-lg font-medium">Temporary Mails</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 flex flex-col max-w-6xl">
        <div className="mb-4 bg-card rounded-lg border p-4 shadow-sm flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex items-center gap-2">
            {editingUsername ? (
              <div className="flex w-full items-center justify-center">
                <Input
                  defaultValue={username}
                  onChange={handleUsernameChange}
                  className="font-mono bg-background/50 text-center"
                  autoFocus
                  onBlur={toggleEditMode}
                  onKeyDown={(e) => e.key === 'Enter' && toggleEditMode()}
                />
                <span className="font-mono ml-3 text-muted-foreground">{domain}</span>
              </div>
            ) : (
              <Input
                value={email}
                readOnly
                className="font-mono bg-background/50 cursor-pointer text-center"
                onClick={toggleEditMode}
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyEmail}
              className="h-10 w-10 rounded-full transition-all duration-300"
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only">Copiar email</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleGenerateNewEmail}
              className="h-10 w-10 rounded-full transition-all duration-300"
            >
              <span className="sr-only">Gerar novo email</span>
              <MailPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              className={cn(
                "h-10 w-10 rounded-full transition-all duration-300",
                fetchingMessages && "animate-spin"
              )}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Atualizar</span>
            </Button>

            <Dialog onOpenChange={handleDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full transition-all duration-300"
                >
                  <Settings className="h-4 w-4" />
                  <span className="sr-only">Opções</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Configurações</DialogTitle>
                  <DialogDescription>
                    Personalize as configurações do seu email temporário.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Domínio de Email</h4>
                    <div className="flex gap-2 flex-col">
                      <Select
                        value={tempCustomDomain}
                        onValueChange={handleDomainChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um domínio" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_DOMAINS.map((domain) => (
                            <SelectItem key={domain} value={domain}>
                              {domain}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      O domínio será usado para novos emails gerados.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSaveSettings}>
                    Salvar Alterações
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-16rem)]">
          {isMobile && !showMobileList && selectedMessageId && (
            <div className="flex justify-start mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToList}
                className="gap-1 md:hidden"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </Button>
            </div>
          )}

          <div className={`md:col-span-1 border rounded-lg shadow-sm bg-card overflow-hidden ${isMobile && !showMobileList ? 'hidden md:block' : ''}`}>
            <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
              <h2 className="font-medium">Caixa de entrada</h2>
              <div className="text-xs text-muted-foreground">
                {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
              </div>
            </div>
            <MessageList
              messages={messages}
              onSelectMessage={handleSelectMessage}
              selectedMessageId={selectedMessageId}
            />
          </div>

          <div className={`md:col-span-2 ${isMobile && showMobileList ? 'hidden md:block' : ''}`}>
            <MessageViewer
              messageContent={messageContent}
              loading={loading}
            />
          </div>
        </div>
      </main>

      <footer className="py-4 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          Disponível no
          <a href="https://github.com/victoriovm/temp-mail" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.207 11.387.6.113.793-.263.793-.587 0-.287-.012-1.243-.018-2.253-3.338.725-4.042-1.613-4.042-1.613-.546-1.387-1.333-1.756-1.333-1.756-1.09-.744.083-.729.083-.729 1.204.087 1.837 1.237 1.837 1.237 1.07 1.833 2.807 1.303 3.492.996.108-.775.42-1.303.763-1.603-2.665-.303-5.467-1.333-5.467-5.93 0-1.31.468-2.382 1.236-3.222-.123-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.3 1.23.957-.266 1.983-.399 3.003-.405 1.02.006 2.047.139 3.006.405 2.29-1.552 3.296-1.23 3.296-1.23.654 1.653.242 2.873.12 3.176.77.84 1.236 1.912 1.236 3.222 0 4.61-2.807 5.624-5.478 5.92.432.372.816 1.102.816 2.222 0 1.606-.015 2.902-.015 3.296 0 .324.192.705.798.586C20.565 21.796 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
