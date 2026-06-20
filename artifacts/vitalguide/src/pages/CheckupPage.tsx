import { useState, useRef } from "react";
import { useListConversations, useGetConversationMessages, useCreateConversation, getListConversationsQueryKey, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import ChatInterface from "@/components/chat/ChatInterface";
import { Button } from "@/components/ui/button";
import { Stethoscope, Plus, MessageSquare, Trash2, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function DocumentUploadButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("document", file);
    try {
      const res = await fetch("/api/documents/upload", { method: "POST", credentials: "include", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const doc = await res.json();
      if (doc.extractedData && Object.keys(doc.extractedData).length > 0) {
        toast({ title: "Document scanned", description: "Medical data saved to your profile's Additional Details." });
      } else {
        toast({ title: "Document uploaded", description: "Saved — check your profile for extracted details." });
      }
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="w-full justify-start gap-2 border-slate-200 text-slate-600 hover:text-slate-900 text-xs"
      >
        <Upload className="w-3.5 h-3.5" />
        {uploading ? "Scanning..." : "Upload Medical Doc"}
      </Button>
    </>
  );
}

export default function CheckupPage() {
  const { data: conversations, isLoading: isLoadingConvos } = useListConversations();
  const createConversation = useCreateConversation();
  const { toast } = useToast();

  const checkupConvos = conversations?.filter(c => c.mode === "checkup") || [];
  const [activeId, setActiveId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleNew = () => {
    createConversation.mutate({ data: { mode: "checkup", title: "New Health Checkup" } }, {
      onSuccess: (data) => {
        setActiveId(data.id);
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      }
    });
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      const res = await fetch(`/api/chat/conversations/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
      if (activeId === id) setActiveId(null);
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      toast({ title: "Checkup deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  if (!activeId && checkupConvos.length > 0 && !deletingId) {
    setActiveId(checkupConvos[checkupConvos.length - 1].id);
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500">
      <div className="w-full md:w-72 flex-shrink-0 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <Stethoscope className="w-6 h-6 text-teal-700" />Checkup
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

        <DocumentUploadButton />

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {isLoadingConvos ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-md" />)
          ) : (
            [...checkupConvos].reverse().map(c => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                  activeId === c.id
                    ? "bg-teal-50 border-teal-200 text-teal-900"
                    : "bg-transparent border-transparent text-slate-600 hover:bg-slate-100 hover:border-slate-200"
                }`}
                onClick={() => setActiveId(c.id)}
              >
                <MessageSquare className={`w-4 h-4 shrink-0 ${activeId === c.id ? "text-teal-600" : "text-slate-400"}`} />
                <span className="text-sm flex-1 truncate font-medium">{c.title || "Checkup Session"}</span>
                <button
                  type="button"
                  onClick={e => handleDelete(c.id, e)}
                  disabled={deletingId === c.id}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all shrink-0"
                  title="Delete this checkup"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
          {!isLoadingConvos && checkupConvos.length === 0 && (
            <div className="text-sm text-slate-500 text-center py-6 px-4 bg-slate-50 rounded-lg border border-slate-100">
              No previous checkups. Start one above.
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
              Describe your symptoms and get thoughtful, preliminary medical guidance in a calm, private setting.
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
