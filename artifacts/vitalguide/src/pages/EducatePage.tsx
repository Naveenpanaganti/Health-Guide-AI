import { useState } from "react";
import { useListConversations, useGetConversationMessages, useCreateConversation, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import ChatInterface from "@/components/chat/ChatInterface";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, MessageSquare, ArrowRight, Lightbulb } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";

export default function EducatePage() {
  const { data: conversations, isLoading: isLoadingConvos } = useListConversations();
  const createConversation = useCreateConversation();
  
  const eduConvos = conversations?.filter(c => c.mode === "education") || [];
  const [activeId, setActiveId] = useState<number | null>(null);

  const handleNew = () => {
    createConversation.mutate({ data: { mode: "education", title: "New Learning Session" } }, {
      onSuccess: (data) => {
        setActiveId(data.id);
        queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      }
    });
  };

  if (!activeId && eduConvos.length > 0) {
    setActiveId(eduConvos[eduConvos.length - 1].id);
  }

  const starterQuestions = [
    { title: "Intermittent Fasting", desc: "What are the scientific benefits of intermittent fasting?", icon: "🕒" },
    { title: "Sleep & Immunity", desc: "How exactly does deep sleep affect immune function?", icon: "💤" },
    { title: "Heart-Healthy Diet", desc: "Explain the basics of a heart-healthy diet", icon: "❤️" },
    { title: "Exercise Science", desc: "What is the difference between aerobic and anaerobic exercise?", icon: "🏃" }
  ];

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500">
      <div className="w-full md:w-72 flex-shrink-0 flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <BookOpen className="w-6 h-6 text-indigo-700" />
            Education
          </h1>
          <p className="text-sm text-slate-500 mt-1">Explore medical science & wellness</p>
        </div>
        
        <Button 
          onClick={handleNew} 
          disabled={createConversation.isPending} 
          className="w-full justify-start bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-50 hover:text-indigo-900 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Start New Topic
        </Button>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
          {isLoadingConvos ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-md" />)
          ) : (
            [...eduConvos].reverse().map(c => (
              <button 
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left px-3.5 py-2.5 text-sm rounded-lg truncate transition-all flex items-center gap-3 border ${
                  activeId === c.id 
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-medium shadow-sm" 
                    : "bg-transparent border-transparent text-slate-600 hover:bg-slate-100"
                }`}
              >
                <MessageSquare className={`w-4 h-4 shrink-0 ${activeId === c.id ? "text-indigo-600" : "text-slate-400"}`} />
                <span className="truncate">{c.title || "Education Session"}</span>
              </button>
            ))
          )}
          {!isLoadingConvos && eduConvos.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-6 px-4 bg-slate-50 rounded-lg border border-slate-100">
              No topics explored yet. Start a new one above.
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 h-full overflow-hidden flex flex-col">
        {activeId ? (
          <EducationChat conversationId={activeId} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50/50 overflow-y-auto">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
              <Lightbulb className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight text-center">What would you like to learn?</h3>
            <p className="text-slate-600 mb-10 max-w-lg text-center text-base leading-relaxed">
              Dive deep into human biology, nutrition, fitness science, or general wellness practices with your AI guide.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl w-full">
              {starterQuestions.map((q, i) => (
                <button 
                  key={i}
                  onClick={() => {
                    createConversation.mutate({ data: { mode: "education", title: q.title } }, {
                      onSuccess: (data) => {
                        setActiveId(data.id);
                        queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
                      }
                    });
                  }}
                  className="p-5 bg-white border border-slate-200 rounded-xl text-left hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-lg">{q.icon}</span>
                    <ArrowRight className="w-4 h-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                  </div>
                  <h4 className="font-semibold text-slate-900 mb-1">{q.title}</h4>
                  <p className="text-sm text-slate-500 mt-auto">{q.desc}</p>
                </button>
              ))}
            </div>
            
            <Button onClick={handleNew} className="mt-10 bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm px-8" size="lg">
              Start Custom Topic
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function EducationChat({ conversationId }: { conversationId: number }) {
  const { data: messages, isLoading } = useGetConversationMessages(conversationId, {
    query: { enabled: !!conversationId, queryKey: getGetConversationMessagesQueryKey(conversationId) }
  });

  if (isLoading) return (
    <div className="h-full p-8 flex flex-col gap-6">
      <Skeleton className="h-24 w-3/4 self-start rounded-2xl rounded-tl-sm" />
      <Skeleton className="h-20 w-3/4 self-end rounded-2xl rounded-tr-sm" />
      <Skeleton className="h-40 w-3/4 self-start rounded-2xl rounded-tl-sm" />
    </div>
  );

  return <ChatInterface conversationId={conversationId} initialMessages={messages || []} mode="education" />;
}
