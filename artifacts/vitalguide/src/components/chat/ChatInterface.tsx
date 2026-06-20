import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getGetConversationMessagesQueryKey, type Message } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";

interface ChatInterfaceProps {
  conversationId: number;
  initialMessages?: Message[];
  mode: "checkup" | "planner" | "education";
}

export default function ChatInterface({ conversationId, initialMessages = [], mode }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: input,
      createdAt: new Date().toISOString()
    };
    
    const contentToSend = input;
    setInput("");
    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    const assistantMessageId = Date.now() + 1;
    setMessages(prev => [...prev, { id: assistantMessageId, role: "assistant", content: "", createdAt: new Date().toISOString() }]);

    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: contentToSend }),
      });
      
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      
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
              if (parsed.content) {
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
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
      queryClient.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(conversationId) });
    }
  };

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
            <div key={msg.id} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${getIconColors(msg.role)}`}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-[15px] leading-relaxed shadow-sm ${
                msg.role === "user" 
                  ? "bg-teal-600 text-white rounded-tr-sm" 
                  : `${getRoleColors(msg.role)} rounded-tl-sm`
              }`}>
                <div className="whitespace-pre-wrap font-sans break-words">{msg.content}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} className="h-2" />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-slate-100 bg-slate-50/80">
        <form onSubmit={sendMessage} className="flex gap-3 max-w-4xl mx-auto">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-white border-slate-200 shadow-sm h-12 text-base rounded-full px-5 focus-visible:ring-teal-600"
            disabled={isStreaming}
          />
          <Button 
            type="submit" 
            disabled={!input.trim() || isStreaming} 
            className="h-12 w-12 rounded-full p-0 flex-shrink-0 bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
          >
            <Send className="w-5 h-5 ml-1" />
          </Button>
        </form>
      </div>
    </div>
  );
}
