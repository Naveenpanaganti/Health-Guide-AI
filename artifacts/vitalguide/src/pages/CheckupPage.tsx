import { useState } from "react";
import { useListConversations, useGetConversationMessages, useCreateConversation, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import ChatInterface from "@/components/chat/ChatInterface";
import { Button } from "@/components/ui/button";
import { Stethoscope, Plus, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";

export default function CheckupPage() {
  const { data: conversations, isLoading: isLoadingConvos } = useListConversations();
  const createConversation = useCreateConversation();
  
  const checkupConvos = conversations?.filter(c => c.mode === "checkup") || [];
  const [activeId, setActiveId] = useState<number | null>(null);

  const handleNew = () => {
    createConversation.mutate({ data: { mode: "checkup", title: "New Health Checkup" } }, {
      onSuccess: (data) => {
        setActiveId(data.id);
        queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      }
    });
  };

  if (!activeId && checkupConvos.length > 0) {
    setActiveId(checkupConvos[checkupConvos.length - 1].id); // Select most recent
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500">
      <div className="w-full md:w-72 flex-shrink-0 flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <Stethoscope className="w-6 h-6 text-teal-700" />
            Checkup
          </h1>
          <p className="text-sm text-slate-500 mt-1">AI Health Assessment</p>
        </div>
        
        <Button 
          onClick={handleNew} 
          disabled={createConversation.isPending} 
          className="w-full justify-start bg-white border border-teal-200 text-teal-800 hover:bg-teal-50 hover:text-teal-900 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Start New Checkup
        </Button>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
          {isLoadingConvos ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-md" />)
          ) : (
            [...checkupConvos].reverse().map(c => (
              <button 
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-3.5 py-2.5 text-sm rounded-lg truncate transition-all flex items-center gap-3 border ${
                  activeId === c.id 
                    ? "bg-teal-50 border-teal-200 text-teal-900 font-medium shadow-sm" 
                    : "bg-transparent border-transparent text-slate-600 hover:bg-slate-100"
                }`}
              >
                <MessageSquare className={`w-4 h-4 shrink-0 ${activeId === c.id ? "text-teal-600" : "text-slate-400"}`} />
                <span className="truncate">{c.title || "Checkup Session"}</span>
              </button>
            ))
          )}
          {!isLoadingConvos && checkupConvos.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-6 px-4 bg-slate-50 rounded-lg border border-slate-100">
              No previous checkups. Start a new one above.
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 h-full overflow-hidden flex flex-col">
        {activeId ? (
          <CheckupChat conversationId={activeId} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-slate-50/50">
            <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6">
              <Stethoscope className="w-10 h-10 text-teal-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 tracking-tight">Your AI Health Checkup</h3>
            <p className="mt-3 max-w-md text-base leading-relaxed text-slate-600">
              Discuss symptoms, general health concerns, and get thoughtful, preliminary medical guidance in a calm setting.
            </p>
            <Button onClick={handleNew} className="mt-8 bg-teal-600 text-white hover:bg-teal-700 shadow-sm px-8" size="lg">
              Start Checkup
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckupChat({ conversationId }: { conversationId: number }) {
  const { data: messages, isLoading } = useGetConversationMessages(conversationId, {
    query: { enabled: !!conversationId, queryKey: getGetConversationMessagesQueryKey(conversationId) }
  });

  if (isLoading) return (
    <div className="h-full p-8 flex flex-col gap-6">
      <Skeleton className="h-20 w-3/4 self-start rounded-2xl rounded-tl-sm" />
      <Skeleton className="h-20 w-3/4 self-end rounded-2xl rounded-tr-sm" />
      <Skeleton className="h-32 w-3/4 self-start rounded-2xl rounded-tl-sm" />
    </div>
  );

  return <ChatInterface conversationId={conversationId} initialMessages={messages || []} mode="checkup" />;
}
