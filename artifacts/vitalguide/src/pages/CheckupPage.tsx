import { useState, useRef } from "react";
import { useListConversations, useGetConversationMessages, useCreateConversation, getListConversationsQueryKey, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import ChatInterface from "@/components/chat/ChatInterface";
import { Button } from "@/components/ui/button";
import { Stethoscope, Plus, MessageSquare, Trash2, Upload, FileText, ShieldCheck, UserX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function OwnershipDialog({
  open, filename, onConfirm, onCancel,
}: { open: boolean; filename: string; onConfirm: (isOwner: boolean) => void; onCancel: () => void }) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            Who does this document belong to?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 pt-1">
            <span className="font-medium text-slate-700 block">&quot;{filename}&quot;</span>
            <span className="block">
              If this is <strong>your</strong> document, VitalGuide will read it, update your health profile, and use it to give you more personalized health guidance here.
            </span>
            <span className="block text-xs text-slate-400">
              If it belongs to someone else, it will be saved for reference only.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={onCancel} className="order-last sm:order-first">Cancel</AlertDialogCancel>
          <button
            onClick={() => onConfirm(false)}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <UserX className="w-4 h-4" />
            Someone else's
          </button>
          <AlertDialogAction
            onClick={() => onConfirm(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2 inline-flex items-center"
          >
            <ShieldCheck className="w-4 h-4" />
            Yes, it's mine
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DocumentUploadButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [ownershipDialog, setOwnershipDialog] = useState<{ file: File; open: boolean } | null>(null);
  const { toast } = useToast();

  const handleFileSelected = (file: File) => {
    setOwnershipDialog({ file, open: true });
  };

  const handleOwnershipConfirmed = async (isOwner: boolean) => {
    const file = ownershipDialog?.file;
    setOwnershipDialog(null);
    if (!file) return;
    await doUpload(file, isOwner);
  };

  const handleOwnershipCancel = () => {
    setOwnershipDialog(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const doUpload = async (file: File, belongsToUser: boolean) => {
    setUploading(true);
    const form = new FormData();
    form.append("document", file);
    form.append("belongsToUser", String(belongsToUser));
    try {
      const res = await fetch("/api/documents/upload", { method: "POST", credentials: "include", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const doc = await res.json();

      if (!belongsToUser) {
        toast({ title: "Document saved", description: "Saved for reference only — not your document." });
      } else if (doc.profileUpdated) {
        toast({
          title: "Profile updated ✓",
          description: `Document scanned and profile updated with new health data.`,
        });
      } else if (doc.extractedData && Object.keys(doc.extractedData).length > 0) {
        toast({ title: "Document scanned", description: doc.profileUpdateReason || "Medical data extracted and saved to your profile." });
      } else {
        toast({ title: "Document uploaded", description: "Saved. Check your profile for details." });
      }
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      {ownershipDialog && (
        <OwnershipDialog
          open={ownershipDialog.open}
          filename={ownershipDialog.file.name}
          onConfirm={handleOwnershipConfirmed}
          onCancel={handleOwnershipCancel}
        />
      )}
      <input
        ref={fileRef} type="file" className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }}
      />
      <Button
        type="button" variant="outline" size="sm" disabled={uploading}
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

  const activeConvo = checkupConvos.find(c => c.id === activeId) ?? checkupConvos[0] ?? null;
  const effectiveId = activeId ?? activeConvo?.id ?? null;

  const { data: msgs, isLoading: isLoadingMsgs } = useGetConversationMessages(
    { id: effectiveId! },
    { query: { enabled: !!effectiveId, queryKey: getGetConversationMessagesQueryKey({ id: effectiveId! }) } }
  );

  const handleNew = () => {
    createConversation.mutate(
      { data: { title: `Checkup ${new Date().toLocaleDateString()}`, mode: "checkup" } },
      {
        onSuccess: (newConvo) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          setActiveId(newConvo.id);
        },
        onError: () => toast({ title: "Failed to create conversation", variant: "destructive" }),
      }
    );
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      if (activeId === id) setActiveId(null);
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <h2 className="font-semibold text-slate-800">Health Checkup</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={handleNew} disabled={createConversation.isPending} className="h-8 w-8 p-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <DocumentUploadButton />

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {isLoadingConvos ? (
            <>
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </>
          ) : checkupConvos.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
              No checkup sessions yet
            </div>
          ) : (
            checkupConvos.map(c => (
              <div
                key={c.id}
                className={`group flex items-center justify-between gap-1 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  (effectiveId === c.id) ? "bg-teal-50 text-teal-700" : "hover:bg-slate-100 text-slate-700"
                }`}
                onClick={() => setActiveId(c.id)}
              >
                <span className="text-sm truncate flex-1">{c.title}</span>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                  onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                  disabled={deletingId === c.id}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-w-0">
        {!effectiveId ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center">
              <Stethoscope className="w-8 h-8 text-teal-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 mb-1">Start a Health Checkup</h3>
              <p className="text-sm text-slate-500 max-w-xs">Describe your symptoms or concerns and get personalized guidance from your AI health assistant.</p>
            </div>
            <Button onClick={handleNew} disabled={createConversation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              New Checkup Session
            </Button>
          </div>
        ) : isLoadingMsgs ? (
          <div className="h-full flex flex-col gap-3 p-4">
            <Skeleton className="h-16 w-3/4 rounded-xl" />
            <Skeleton className="h-16 w-2/3 rounded-xl ml-auto" />
            <Skeleton className="h-16 w-3/4 rounded-xl" />
          </div>
        ) : (
          <ChatInterface
            conversationId={effectiveId}
            mode="checkup"
            initialMessages={msgs ?? []}
            onMessagesChange={() => queryClient.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey({ id: effectiveId }) })}
          />
        )}
      </div>
    </div>
  );
}
