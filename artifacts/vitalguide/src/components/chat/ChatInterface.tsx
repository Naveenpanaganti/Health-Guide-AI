import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Send, Bot, User, AlertTriangle, WifiOff, KeyRound, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getGetConversationMessagesQueryKey, type Message } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";

export interface ChatInterfaceHandle {
  sendMessage: (text: string) => void;
}

interface ChatInterfaceProps {
  conversationId: number;
  initialMessages?: Message[];
  mode: "checkup" | "planner" | "education";
  autoPrompt?: string;
}

type ChatError =
  | { kind: "quota"; message: string }
  | { kind: "invalid_key"; message: string }
  | { kind: "permission"; message: string }
  | { kind: "no_key"; message: string }
  | { kind: "generic"; message: string };

function parseChatError(msg: string): ChatError {
  const lower = msg.toLowerCase();
  if (lower.includes("quota") || lower.includes("exhausted") || lower.includes("billing")) {
    return { kind: "quota", message: msg };
  }
  if (lower.includes("invalid") && lower.includes("key")) {
    return { kind: "invalid_key", message: msg };
  }
  if (lower.includes("permission")) {
    return { kind: "permission", message: msg };
  }
  if (lower.includes("no gemini api key") || lower.includes("gemini_api_key")) {
    return { kind: "no_key", message: msg };
  }
  return { kind: "generic", message: msg };
}

function ErrorBanner({ error, onDismiss }: { error: ChatError; onDismiss: () => void }) {
  const configs: Record<ChatError["kind"], { icon: React.ReactNode; title: string; body: string; color: string }> = {
    quota: {
      icon: <Gauge className="h-4 w-4" />,
      title: "API Quota Exceeded",
      body: "Your Gemini API quota has been used up. Please check your Google AI billing or wait for the quota to reset.",
      color: "border-orange-200 bg-orange-50 text-orange-800",
    },
    invalid_key: {
      icon: <KeyRound className="h-4 w-4" />,
      title: "Invalid API Key",
      body: "Your Gemini API key is invalid. Please update the GEMINI_API_KEY secret with a valid key.",
      color: "border-red-200 bg-red-50 text-red-800",
    },
    permission: {
      icon: <KeyRound className="h-4 w-4" />,
      title: "API Permission Denied",
      body: "Your API key doesn't have permission. Make sure the Gemini API is enabled in your Google Cloud project.",
      color: "border-red-200 bg-red-50 text-red-800",
    },
    no_key: {
      icon: <KeyRound className="h-4 w-4" />,
      title: "API Key Not Configured",
      body: "No Gemini API key found. Please add your key as GEMINI_API_KEY in Replit Secrets.",
      color: "border-yellow-200 bg-yellow-50 text-yellow-800",
    },
    generic: {
      icon: <WifiOff className="h-4 w-4" />,
      title: "AI Unavailable",
      body: error.message || "The AI assistant encountered an error. Please try again.",
      color: "border-slate-200 bg-slate-50 text-slate-800",
    },
  };

  const cfg = configs[error.kind];

  return (
    <div className={`mx-4 mt-3 rounded-lg border p-3 flex gap-2.5 items-start ${cfg.color}`}>
      <span className="mt-0.5 flex-shrink-0">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{cfg.title}</p>
        <p className="text-xs mt-0.5 leading-snug opacity-80">{cfg.body}</p>
      </div>
      <button onClick={onDismiss} className="text-xs opacity-50 hover:opacity-100 flex-shrink-0 ml-1 mt-0.5">✕</button>
    </div>
  );
}

const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(function ChatInterface(
  { conversationId, initialMessages = [], mode, autoPrompt },
  ref
) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<ChatError | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoPromptFiredRef = useRef(false);

  useEffect(() => {
    setMessages(initialMessages);
    autoPromptFiredRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const hasEmergency = messages.some(m => m.role === "assistant" && (
    m.content.toLowerCase().includes("emergency") ||
    m.content.toLowerCase().includes("911") ||
    m.content.toLowerCase().includes("urgent medical")
  ));

  const getRoleColors = (role: string) => {
    if (role === "user") return "bg-teal-600 text-white";
    if (mode === "checkup") return "bg-teal-50 text-teal-900 border border-teal-100";
    if (mode === "planner") return "bg-blue-50 text-blue-900 border border-blue-100";
    if (mode === "education") return "bg-indigo-50 text-indigo-900 border border-indigo-100";
    return "bg-slate-50 border border-slate-100 text-slate-800";
  };

  const getIconColors = (role: string) => {
    if (role === "user") return "bg-teal-600 text-white";
    if (mode === "checkup") return "bg-teal-100 text-teal-700";
    if (mode === "planner") return "bg-blue-100 text-blue-700";
    if (mode === "education") return "bg-indigo-100 text-indigo-700";
    return "bg-slate-100 text-slate-700";
  };

  const sendText = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    setChatError(null);

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    const assistantMessageId = Date.now() + 1;
    setMessages(prev => [...prev, { id: assistantMessageId, role: "assistant", content: "", createdAt: new Date().toISOString() }]);

    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        const parsed = parseChatError(errBody.error ?? `Request failed with status ${res.status}`);
        setChatError(parsed);
        setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") {
              setIsStreaming(false);
              queryClient.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(conversationId) });
              return;
            }
            try {
              const parsed = JSON.parse(raw);
              if (parsed.error) {
                const chatErr = parseChatError(parsed.error);
                setChatError(chatErr);
                setMessages(prev => prev.filter(m => m.id !== assistantMessageId || receivedContent));
                return;
              }
              if (parsed.content) {
                receivedContent = true;
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: m.content + parsed.content }
                    : m
                ));
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      const parsed = parseChatError(err?.message ?? "Network error. Please check your connection.");
      setChatError(parsed);
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
    } finally {
      setIsStreaming(false);
      queryClient.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(conversationId) });
    }
  };

  useEffect(() => {
    if (autoPrompt && !autoPromptFiredRef.current && !isStreaming) {
      autoPromptFiredRef.current = true;
      const timer = setTimeout(() => sendText(autoPrompt), 300);
      return () => clearTimeout(timer);
    }
  }, [autoPrompt]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    await sendText(text);
  };

  useImperativeHandle(ref, () => ({
    sendMessage: (text: string) => { sendText(text); },
  }));

  return (
    <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden w-full">
      {mode === "checkup" && hasEmergency && (
        <Alert variant="destructive" className="rounded-none border-t-0 border-l-0 border-r-0 border-b-2 border-red-200 bg-red-50 py-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm font-bold">Medical Alert</AlertTitle>
          <AlertDescription className="text-xs">
            This guidance suggests a possible emergency. Please seek immediate professional medical attention or call emergency services.
          </AlertDescription>
        </Alert>
      )}

      {chatError && (
        <ErrorBanner error={chatError} onDismiss={() => setChatError(null)} />
      )}

      <ScrollArea className="flex-1 p-4 md:p-6" ref={scrollRef}>
        <div className="space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${getIconColors("assistant")}`}>
                <Bot className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">How can I help?</h3>
              <p className="mt-1 max-w-xs text-sm">Send a message to start the conversation.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 md:gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${getIconColors(msg.role)}`}>
                {msg.role === "user" ? <User className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Bot className="w-3.5 h-3.5 md:w-4 md:h-4" />}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-[15px] leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-teal-600 text-white rounded-tr-sm"
                  : `${getRoleColors(msg.role)} rounded-tl-sm`
              }`}>
                {msg.content ? (
                  <div className="whitespace-pre-wrap font-sans break-words">{msg.content}</div>
                ) : (
                  isStreaming && (
                    <div className="flex gap-1 items-center py-1">
                      <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} className="h-2" />
        </div>
      </ScrollArea>

      <div className="p-3 md:p-4 border-t border-slate-100 bg-slate-50/80">
        <form onSubmit={sendMessage} className="flex gap-2 md:gap-3 max-w-4xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-white border-slate-200 shadow-sm h-11 md:h-12 text-sm md:text-base rounded-full px-4 md:px-5 focus-visible:ring-teal-600"
            disabled={isStreaming}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="h-11 w-11 md:h-12 md:w-12 rounded-full p-0 flex-shrink-0 bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
          >
            <Send className="w-4 h-4 md:w-5 md:h-5 ml-0.5" />
          </Button>
        </form>
      </div>
    </div>
  );
});

export default ChatInterface;
