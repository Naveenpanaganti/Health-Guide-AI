import { useState, useRef, useEffect, useCallback } from "react";
import { useListConversations, useGetConversationMessages, useCreateConversation, getListConversationsQueryKey, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import ChatInterface, { type ChatInterfaceHandle } from "@/components/chat/ChatInterface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stethoscope, Plus, MessageSquare, Trash2, Upload, FileText, ShieldCheck, UserX, X, File, Image as ImageIcon, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

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

function FileDropZone({
  file,
  onFile,
  onClear,
}: {
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.type === "application/pdf" || f.type.startsWith("image/"))) onFile(f);
  }, [onFile]);

  const isPdf = file?.type === "application/pdf";
  const fileSize = file ? (file.size / 1024 < 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`) : "";

  if (file) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-teal-200 bg-teal-50">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm border border-teal-100 flex-shrink-0">
          {isPdf ? <FileText className="w-5 h-5 text-red-500" /> : <ImageIcon className="w-5 h-5 text-blue-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
          <p className="text-xs text-slate-500">{isPdf ? "PDF document" : "Image file"} · {fileSize}</p>
        </div>
        <button type="button" onClick={onClear} className="p-1.5 rounded-full hover:bg-white transition-colors text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
        dragging ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-teal-50/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <div className="flex items-center gap-2 text-slate-400">
        <FileText className="w-5 h-5" />
        <ImageIcon className="w-5 h-5" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-600">Drop file here or <span className="text-teal-600">browse</span></p>
        <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG · Max 10 MB</p>
      </div>
    </div>
  );
}

function NewCheckupDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, file: File | null) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState("");

  const reset = () => { setTitle(""); setFile(null); setLoading(false); setTitleError(""); };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) { setTitleError("Please describe your health concern."); return; }
    setLoading(true);
    try {
      await onCreate(trimmed, file);
      reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100">
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            Start a New Health Checkup
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Describe your concern and optionally attach a medical document.
          </p>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Issue title */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              What's the health concern? <span className="text-red-500">*</span>
            </label>
            <Input
              autoFocus
              value={title}
              onChange={e => { setTitle(e.target.value); if (titleError) setTitleError(""); }}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSubmit()}
              placeholder="e.g. Persistent headache, chest tightness, blood test results..."
              className={`h-10 ${titleError ? "border-red-400 focus-visible:ring-red-300" : ""}`}
            />
            {titleError && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {titleError}
              </p>
            )}
          </div>

          {/* File upload */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              Attach a document <span className="text-slate-400 font-normal text-xs ml-1">(optional)</span>
            </label>
            <FileDropZone file={file} onFile={setFile} onClear={() => setFile(null)} />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2 min-w-[130px]"
          >
            {loading ? (
              <><span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> {file ? "Uploading..." : "Creating..."}</>
            ) : (
              <><Plus className="w-4 h-4" /> Start Checkup</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocSummaryCard({
  doc,
  onDismiss,
}: {
  doc: DocUploadResult;
  onDismiss?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const data = doc.extractedData ?? {};

  const keyFields: { label: string; key: string }[] = [
    { label: "Patient", key: "patientName" },
    { label: "Blood Group", key: "bloodGroup" },
    { label: "Diagnoses", key: "diagnoses" },
    { label: "Medications", key: "medications" },
    { label: "Allergies", key: "allergies" },
    { label: "Doctor", key: "doctorName" },
    { label: "Hospital", key: "hospitalName" },
  ];

  const foundFields = keyFields.filter(f => data[f.key]);

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      <div className={`rounded-xl border ${doc.isRelevantMedicalDoc ? "border-teal-200 bg-teal-50/60" : "border-amber-200 bg-amber-50/60"} p-4`}>
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${doc.isRelevantMedicalDoc ? "bg-teal-600" : "bg-amber-500"}`}>
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{doc.filename}</p>
            <p className={`text-xs mt-0.5 ${doc.isRelevantMedicalDoc ? "text-teal-700" : "text-amber-700"}`}>
              {doc.isRelevantMedicalDoc ? "✓ Medical document verified" : "⚠ Limited medical data found"}
            </p>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {doc.summary && (
          <div className="mb-3 bg-white/70 rounded-lg p-3 border border-white">
            <p className="text-xs font-semibold text-slate-600 mb-1">Summary</p>
            <p className="text-xs text-slate-700 leading-relaxed">{doc.summary}</p>
          </div>
        )}

        {doc.isRelevantMedicalDoc && data.reportDate && (
          <p className="text-xs text-slate-500 mb-3">Report date: <span className="font-medium text-slate-700">{String(data.reportDate)}</span></p>
        )}

        {foundFields.length > 0 && (
          <>
            <div className={`space-y-2 overflow-hidden transition-all ${expanded ? "" : "max-h-32"}`}>
              {foundFields.map(({ label, key }) => {
                const val = data[key];
                const display = Array.isArray(val)
                  ? (val as unknown[]).map(v => typeof v === "object" ? JSON.stringify(v) : String(v)).join(", ")
                  : typeof val === "object" ? JSON.stringify(val) : String(val);
                return (
                  <div key={key} className="flex gap-2">
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0">{label}</span>
                    <span className="text-xs font-medium text-slate-800 flex-1">{display}</span>
                  </div>
                );
              })}
            </div>
            {foundFields.length > 3 && (
              <button
                type="button"
                onClick={() => setExpanded(p => !p)}
                className="mt-2 text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1 font-medium"
              >
                {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all fields</>}
              </button>
            )}
          </>
        )}

        {doc.profileUpdated && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-2 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            Health profile updated from this document
          </div>
        )}

        {data.testResults && typeof data.testResults === "object" && Object.keys(data.testResults).length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">Test Results</p>
            <div className="space-y-1.5">
              {Object.entries(data.testResults as Record<string, unknown>).slice(0, expanded ? undefined : 4).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-xs text-slate-500 flex-1">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span className="text-xs font-medium text-slate-800">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
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
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [ownershipPending, setOwnershipPending] = useState<{ file: File; convoId: number } | null>(null);
  const [convoDocMap, setConvoDocMap] = useState<Record<number, DocUploadResult>>({});

  const activeConvo = checkupConvos.find(c => c.id === activeId) ?? checkupConvos[0] ?? null;
  const effectiveId = activeId ?? activeConvo?.id ?? null;
  const activeDoc = effectiveId ? convoDocMap[effectiveId] ?? null : null;

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

  const doUpload = useCallback(async (file: File, belongsToUser: boolean, convoId: number) => {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("belongsToUser", String(belongsToUser));
    const res = await fetch("/api/documents/upload", { method: "POST", credentials: "include", body: formData });
    if (!res.ok) throw new Error("Upload failed");
    const doc: DocUploadResult = await res.json();
    setConvoDocMap(prev => ({ ...prev, [convoId]: doc }));
    return doc;
  }, []);

  const handleOwnershipConfirmed = async (isOwner: boolean) => {
    if (!ownershipPending) return;
    const { file, convoId } = ownershipPending;
    setOwnershipPending(null);
    try {
      const doc = await doUpload(file, isOwner, convoId);
      if (chatRef.current) {
        chatRef.current.sendMessage(formatDocForChat(doc, isOwner));
      }
      if (!doc.isRelevantMedicalDoc) {
        toast({ title: "Not a medical document", description: "Please upload a lab report, prescription, or health record.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleCreate = async (title: string, file: File | null) => {
    return new Promise<void>((resolve, reject) => {
      createConversation.mutate(
        { data: { title, mode: "checkup" } },
        {
          onSuccess: async (newConvo) => {
            queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            setActiveId(newConvo.id);
            setPendingPrompt(null);
            setNewDialogOpen(false);

            if (file) {
              // Ask ownership, then upload
              setOwnershipPending({ file, convoId: newConvo.id });
            }
            resolve();
          },
          onError: (err) => {
            toast({ title: "Failed to create conversation", variant: "destructive" });
            reject(err);
          },
        }
      );
    });
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      if (activeId === id) setActiveId(null);
      setConvoDocMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const hasDoc = !!activeDoc;

  return (
    <>
      <OwnershipDialog
        open={!!ownershipPending}
        filename={ownershipPending?.file.name ?? ""}
        onConfirm={handleOwnershipConfirmed}
        onCancel={() => setOwnershipPending(null)}
      />

      <NewCheckupDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onCreate={handleCreate}
      />

      <div className="flex gap-4 md:gap-6 h-[calc(100vh-8rem)]">
        {/* Left Sidebar */}
        <div className="w-48 md:w-56 flex-shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-teal-600" />
              <h2 className="font-semibold text-slate-800 text-sm md:text-base">Health Checkup</h2>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNewDialogOpen(true)}
              disabled={createConversation.isPending}
              className="h-8 w-8 p-0 hover:bg-teal-50 hover:text-teal-700"
              title="New checkup session"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

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
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {convoDocMap[c.id] && <FileText className="w-3 h-3 flex-shrink-0 text-teal-500" />}
                    <span className="text-xs md:text-sm truncate">{c.title}</span>
                  </div>
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

        {/* Main Content Area */}
        {!effectiveId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center">
              <Stethoscope className="w-8 h-8 text-teal-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 mb-1">Start a Health Checkup</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                Describe your symptoms or upload a medical document to get personalized health guidance.
              </p>
            </div>
            <Button
              onClick={() => setNewDialogOpen(true)}
              disabled={createConversation.isPending}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              New Checkup Session
            </Button>
          </div>
        ) : (
          <div className={`flex-1 min-w-0 flex gap-4 ${hasDoc ? "flex-row" : ""}`}>
            {/* Document Summary Card (center column, only when doc exists) */}
            {hasDoc && (
              <div className="w-64 flex-shrink-0 flex flex-col gap-3">
                <div className="flex items-center gap-2 h-8">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-semibold text-slate-700 truncate">
                    {activeConvo?.title ?? "Document Analysis"}
                  </span>
                </div>
                {isLoadingMsgs ? (
                  <Skeleton className="h-48 w-full rounded-xl" />
                ) : (
                  <DocSummaryCard
                    doc={activeDoc}
                    onDismiss={() => setConvoDocMap(prev => { const n = { ...prev }; if (effectiveId) delete n[effectiveId]; return n; })}
                  />
                )}
              </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 min-w-0 flex flex-col gap-0">
              {!hasDoc && activeConvo && (
                <div className="flex items-center gap-2 mb-3 h-8">
                  <MessageSquare className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-semibold text-slate-700 truncate">{activeConvo.title}</span>
                </div>
              )}
              {isLoadingMsgs ? (
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
        )}
      </div>
    </>
  );
}
