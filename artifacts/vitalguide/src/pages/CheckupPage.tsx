import { useState, useRef, useEffect } from "react";
import { useListConversations, useGetConversationMessages, useCreateConversation, getListConversationsQueryKey, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import ChatInterface, { type ChatInterfaceHandle } from "@/components/chat/ChatInterface";
import { Button } from "@/components/ui/button";
import { Stethoscope, Plus, MessageSquare, Trash2, Upload, FileText, ShieldCheck, UserX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DocUploadResult = {
  filename: string;
  summary: string | null;
  extractedData: Record<string, unknown> | null;
  isRelevantMedicalDoc: boolean;
  profileUpdated: boolean;
  profileUpdateReason?: string;
  profileChanges?: string[];
};

function formatDocForChat(doc: DocUploadResult, isOwner: boolean): string {
  if (!doc.isRelevantMedicalDoc) {
    return `I tried uploading a file called "${doc.filename}" to share my medical records, but it doesn't seem to contain valid medical information. ${doc.summary ? `Here's what was found: ${doc.summary}` : "No medical data could be detected."}\n\nCould you tell me what types of documents I should upload? (e.g., lab reports, prescriptions, discharge summaries)`;
  }

  const data = doc.extractedData ?? {};
  const lines: string[] = [];

  lines.push(`I've just uploaded a medical document: "${doc.filename}"`);
  if (data.reportDate) lines.push(`Document date: ${data.reportDate}`);
  lines.push("");

  if (doc.summary) {
    lines.push(`Summary: ${doc.summary}`);
    lines.push("");
  }

  const keyFields: { label: string; key: string }[] = [
    { label: "Patient Name", key: "patientName" },
    { label: "Blood Group", key: "bloodGroup" },
    { label: "Diagnoses", key: "diagnoses" },
    { label: "Medications", key: "medications" },
    { label: "Allergies", key: "allergies" },
    { label: "Chief Complaints", key: "chiefComplaints" },
    { label: "Doctor", key: "doctorName" },
    { label: "Hospital", key: "hospitalName" },
  ];

  const found = keyFields.filter(f => data[f.key]);
  if (found.length > 0) {
    lines.push("Key details:");
    for (const { label, key } of found) {
      const val = data[key];
      const display = Array.isArray(val)
        ? (val as unknown[]).map(v => typeof v === "object" ? JSON.stringify(v) : String(v)).join(", ")
        : typeof val === "object" ? JSON.stringify(val) : String(val);
      lines.push(`• ${label}: ${display}`);
    }
  }

  if (data.testResults && typeof data.testResults === "object") {
    const results = Object.entries(data.testResults as Record<string, unknown>);
    if (results.length > 0) {
      lines.push("");
      lines.push("Test Results:");
      for (const [k, v] of results) {
        lines.push(`• ${k.replace(/([A-Z])/g, " $1").trim()}: ${v}`);
      }
    }
  }

  lines.push("");
  if (isOwner) {
    lines.push("This is my document. Could you help me understand what these results mean for my health and what I should be aware of?");
  } else {
    lines.push("This document belongs to someone else (not me). Could you help me understand the medical information in it?");
  }

  return lines.join("\n");
}

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
              If this is <strong>your</strong> document, VitalGuide will update your health profile and the AI will read it to give personalized guidance.
            </span>
            <span className="block text-xs text-slate-400">
              If it belongs to someone else, the AI will still analyze it for you — but it won&apos;t update your profile.
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
            Someone else&apos;s
          </button>
          <AlertDialogAction
            onClick={() => onConfirm(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2 inline-flex items-center"
          >
            <ShieldCheck className="w-4 h-4" />
            Yes, it&apos;s mine
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DocumentUploadButton({
  conversationId,
  chatRef,
}: {
  conversationId: number | null;
  chatRef: React.RefObject<ChatInterfaceHandle | null>;
}) {
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
    const formData = new FormData();
    formData.append("document", file);
    formData.append("belongsToUser", String(belongsToUser));
    try {
      const res = await fetch("/api/documents/upload", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const doc: DocUploadResult = await res.json();

      if (conversationId && chatRef.current) {
        const chatMessage = formatDocForChat(doc, belongsToUser);
        chatRef.current.sendMessage(chatMessage);
      } else {
        if (!doc.isRelevantMedicalDoc) {
          toast({ title: "Not a medical document", description: "Please upload a lab report, prescription, or health record.", variant: "destructive" });
        } else {
          toast({ title: "Document scanned", description: doc.summary ?? "Medical data extracted and saved." });
        }
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
  const chatRef = useRef<ChatInterfaceHandle | null>(null);

  const checkupConvos = conversations?.filter(c => c.mode === "checkup") || [];
  const [activeId, setActiveId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const activeConvo = checkupConvos.find(c => c.id === activeId) ?? checkupConvos[0] ?? null;
  const effectiveId = activeId ?? activeConvo?.id ?? null;

  const { data: msgs, isLoading: isLoadingMsgs } = useGetConversationMessages(
    effectiveId!,
    { query: { enabled: !!effectiveId, queryKey: getGetConversationMessagesQueryKey(effectiveId!) } }
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get("prompt");
    if (prompt) {
      const decoded = decodeURIComponent(prompt);
      setPendingPrompt(decoded);
      window.history.replaceState({}, "", "/checkup");
      createConversation.mutate(
        { data: { title: `Document Analysis — ${new Date().toLocaleDateString()}`, mode: "checkup" } },
        {
          onSuccess: (newConvo) => {
            queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            setActiveId(newConvo.id);
          },
        }
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNew = () => {
    createConversation.mutate(
      { data: { title: `Checkup ${new Date().toLocaleDateString()}`, mode: "checkup" } },
      {
        onSuccess: (newConvo) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          setActiveId(newConvo.id);
          setPendingPrompt(null);
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
    <div className="flex gap-4 md:gap-6 h-[calc(100vh-8rem)] md:h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <div className="w-48 md:w-64 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <h2 className="font-semibold text-slate-800 text-sm md:text-base">Health Checkup</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={handleNew} disabled={createConversation.isPending} className="h-8 w-8 p-0">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <DocumentUploadButton conversationId={effectiveId} chatRef={chatRef} />

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
                onClick={() => { setActiveId(c.id); setPendingPrompt(null); }}
              >
                <span className="text-xs md:text-sm truncate flex-1">{c.title}</span>
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
              <p className="text-sm text-slate-500 max-w-xs">Describe your symptoms or upload a medical document to get personalized health guidance.</p>
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
            ref={chatRef}
            conversationId={effectiveId}
            mode="checkup"
            initialMessages={msgs ?? []}
            autoPrompt={pendingPrompt ?? undefined}
          />
        )}
      </div>
    </div>
  );
}
