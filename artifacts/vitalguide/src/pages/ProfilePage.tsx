import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetProfile,
  useUpsertProfile,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Pencil, X, Save, Heart, Pill, Dumbbell, Upload, FileText, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const MEDICAL_CONDITIONS = [
  "Diabetes (Type 1)", "Diabetes (Type 2)", "Hypertension", "Hypotension",
  "Asthma", "COPD", "Obesity", "Heart Disease", "Stroke (History)",
  "Arthritis", "Thyroid Disorder", "PCOS / PCOD", "Kidney Disease",
  "Liver Disease", "Cancer", "Depression", "Anxiety", "Epilepsy / Seizures",
  "Chickenpox (History)", "Tuberculosis (History)", "COVID-19 (History)",
  "Anaemia", "High Cholesterol", "Migraine", "Sleep Apnea", "Other",
];

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.coerce.number().min(1).max(120),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  weight: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  medicalConditions: z.string().optional(),
  medications: z.string().optional(),
  allergies: z.string().optional(),
  sleepHours: z.coerce.number().min(0).max(24).optional(),
  activityLevel: z.string().optional(),
  goals: z.string().optional(),
  location: z.string().optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

type MedicalDocument = {
  id: number;
  filename: string;
  mimeType: string;
  summary: string | null;
  uploadedAt: string;
  extractedData: Record<string, unknown> | null;
};

function ConditionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected: string[] = value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];
  const toggle = (condition: string) => {
    const next = selected.includes(condition)
      ? selected.filter(c => c !== condition)
      : [...selected, condition];
    onChange(next.join(", "));
  };
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-48 overflow-y-auto">
      {MEDICAL_CONDITIONS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => toggle(c)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            selected.includes(c)
              ? "bg-teal-600 text-white border-teal-600"
              : "bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-700"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function ViewField({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-800">{String(value)}</p>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
      <span className="text-teal-600">{icon}</span>
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function DocumentUploadPanel({ onExtracted }: { onExtracted: (data: Record<string, unknown>) => void }) {
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loadedDocs, setLoadedDocs] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadDocuments = async () => {
    if (loadedDocs) { setShowDocs(v => !v); return; }
    try {
      const res = await fetch("/api/documents", { credentials: "include" });
      if (res.ok) { setDocuments(await res.json()); setLoadedDocs(true); setShowDocs(true); }
    } catch {}
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("document", file);
    try {
      const res = await fetch("/api/documents/upload", { method: "POST", credentials: "include", body: form });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Upload failed"); }
      const doc: MedicalDocument = await res.json();
      setDocuments(prev => [doc, ...prev]);
      setLoadedDocs(true);
      setShowDocs(true);
      if (doc.extractedData && Object.keys(doc.extractedData).length > 0) {
        onExtracted(doc.extractedData);
        toast({ title: "Document scanned", description: "Medical data extracted and added to Additional Details." });
      } else {
        toast({ title: "Document uploaded", description: "No data could be extracted. Check OpenAI API quota." });
      }
    } catch (err: unknown) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = async (id: number) => {
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE", credentials: "include" });
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch {
      toast({ title: "Failed to delete document", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50/30 transition-all"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            <p className="text-sm text-slate-600 font-medium">Scanning document with AI...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">Drop a medical document here, or click to browse</p>
            <p className="text-xs text-slate-400">JPEG, PNG, WebP up to 10MB — lab reports, prescriptions, health records</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={loadDocuments}
        className="flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
      >
        <FileText className="w-3.5 h-3.5" />
        {showDocs ? "Hide" : "View"} uploaded documents ({loadedDocs ? documents.length : "..."})
        {showDocs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {showDocs && (
        <div className="space-y-2">
          {documents.length === 0 && <p className="text-xs text-slate-400 py-2">No documents uploaded yet.</p>}
          {documents.map(doc => (
            <div key={doc.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-teal-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-800 truncate">{doc.filename}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)} className="p-1 text-slate-400 hover:text-slate-700">
                    {expandedDoc === doc.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => deleteDoc(doc.id)} className="p-1 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {doc.summary && <p className="text-xs text-slate-500">{doc.summary}</p>}
              {expandedDoc === doc.id && doc.extractedData && (
                <div className="mt-2 bg-slate-50 rounded-lg p-3 text-xs text-slate-700 space-y-1">
                  {Object.entries(doc.extractedData).filter(([k]) => k !== "summary").map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="font-medium text-slate-500 capitalize min-w-24">{k.replace(/([A-Z])/g, " $1")}:</span>
                      <span>{Array.isArray(v) ? (v as unknown[]).join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { data: profile, isLoading } = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const upsertProfile = useUpsertProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [additionalDetails, setAdditionalDetails] = useState<Record<string, unknown> | null>(null);

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile ? {
      name: profile.name,
      age: profile.age,
      gender: profile.gender ?? "",
      bloodGroup: profile.bloodGroup ?? "",
      weight: profile.weight ?? undefined,
      height: profile.height ?? undefined,
      medicalConditions: profile.medicalConditions ?? "",
      medications: profile.medications ?? "",
      allergies: profile.allergies ?? "",
      sleepHours: profile.sleepHours ?? undefined,
      activityLevel: profile.activityLevel ?? "",
      goals: profile.goals ?? "",
      location: profile.location ?? "",
    } : undefined,
  });

  const onSubmit = (data: ProfileForm) => {
    const addlStr = additionalDetails ? JSON.stringify(additionalDetails) : (profile?.additionalDetails ?? undefined);
    upsertProfile.mutate(
      { data: { ...data, age: Number(data.age), additionalDetails: addlStr } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          setEditing(false);
          toast({ title: "Profile updated", description: "Your health profile has been saved." });
        },
        onError: () => {
          toast({ title: "Error saving profile", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleDocExtracted = (data: Record<string, unknown>) => {
    setAdditionalDetails(data);
  };

  const parsedAdditional: Record<string, unknown> | null = (() => {
    if (additionalDetails) return additionalDetails;
    if (profile?.additionalDetails) {
      try { return JSON.parse(profile.additionalDetails); } catch { return null; }
    }
    return null;
  })();

  const conditions = profile?.medicalConditions?.split(",").map(s => s.trim()).filter(Boolean) ?? [];

  const activityLabels: Record<string, string> = {
    sedentary: "Sedentary", light: "Lightly Active", moderate: "Moderately Active",
    active: "Active", very_active: "Very Active",
  };
  const genderLabels: Record<string, string> = {
    male: "Male", female: "Female", other: "Other", prefer_not_to_say: "Prefer not to say",
  };

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
            <User className="w-7 h-7 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{profile?.name ?? "Your Profile"}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Health profile and personal details</p>
          </div>
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-2 border-slate-200">
            <Pencil className="w-4 h-4" />Edit Profile
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => { setEditing(false); form.reset(); }} className="gap-2 text-slate-500">
            <X className="w-4 h-4" />Cancel
          </Button>
        )}
      </div>

      {editing ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Basic Info */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-teal-600" />Basic Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} placeholder="Your name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem><FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="bloodGroup" render={({ field }) => (
                  <FormItem><FormLabel>Blood Group</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {BLOOD_GROUPS.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} placeholder="City, Country" /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Physical Stats */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Heart className="w-4 h-4 text-teal-600" />Physical Stats</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="weight" render={({ field }) => (
                  <FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input type="number" step="0.1" {...field} placeholder="e.g. 70" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="height" render={({ field }) => (
                  <FormItem><FormLabel>Height (cm)</FormLabel><FormControl><Input type="number" {...field} placeholder="e.g. 175" /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Medical Details */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Pill className="w-4 h-4 text-teal-600" />Medical Details</CardTitle>
                <CardDescription className="text-xs">Select all that apply. This personalizes your AI guidance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="medicalConditions" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medical Conditions</FormLabel>
                    <ConditionPicker value={field.value ?? ""} onChange={field.onChange} />
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="medications" render={({ field }) => (
                  <FormItem><FormLabel>Current Medications</FormLabel><FormControl><Textarea {...field} placeholder="e.g. Metformin 500mg twice daily" rows={2} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="allergies" render={({ field }) => (
                  <FormItem><FormLabel>Allergies</FormLabel><FormControl><Textarea {...field} placeholder="e.g. Penicillin, peanuts" rows={2} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            {/* Lifestyle */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Dumbbell className="w-4 h-4 text-teal-600" />Lifestyle & Goals</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="sleepHours" render={({ field }) => (
                  <FormItem><FormLabel>Sleep (hrs/night)</FormLabel><FormControl><Input type="number" step="0.5" {...field} placeholder="e.g. 7.5" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="activityLevel" render={({ field }) => (
                  <FormItem><FormLabel>Activity Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="sedentary">Sedentary</SelectItem>
                        <SelectItem value="light">Lightly Active</SelectItem>
                        <SelectItem value="moderate">Moderately Active</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="very_active">Very Active</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <div className="md:col-span-2">
                  <FormField control={form.control} name="goals" render={({ field }) => (
                    <FormItem><FormLabel>Health Goals</FormLabel><FormControl><Textarea {...field} placeholder="e.g. Lose 5kg, manage blood sugar" rows={2} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Document Upload */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4 text-teal-600" />Medical Documents</CardTitle>
                <CardDescription className="text-xs">Upload lab reports, prescriptions, or health records. AI will scan and extract data automatically.</CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentUploadPanel onExtracted={handleDocExtracted} />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pb-6">
              <Button type="button" variant="outline" onClick={() => { setEditing(false); form.reset(); }}>Cancel</Button>
              <Button type="submit" disabled={upsertProfile.isPending} className="bg-teal-600 hover:bg-teal-700 text-white gap-2">
                <Save className="w-4 h-4" />
                {upsertProfile.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6 space-y-6">
              {/* Basic Info */}
              <div>
                <SectionHeader icon={<User className="w-4 h-4" />} title="Basic Information" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ViewField label="Full Name" value={profile?.name} />
                  <ViewField label="Age" value={profile?.age ? `${profile.age} yrs` : null} />
                  <ViewField label="Gender" value={profile?.gender ? (genderLabels[profile.gender] ?? profile.gender) : null} />
                  <ViewField label="Blood Group" value={profile?.bloodGroup} />
                  <ViewField label="Location" value={profile?.location} />
                </div>
              </div>

              {/* Physical */}
              <div>
                <SectionHeader icon={<Heart className="w-4 h-4" />} title="Physical Stats" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <ViewField label="Weight" value={profile?.weight ? `${profile.weight} kg` : null} />
                  <ViewField label="Height" value={profile?.height ? `${profile.height} cm` : null} />
                  {profile?.weight && profile?.height && (
                    <ViewField label="BMI" value={(profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1)} />
                  )}
                </div>
              </div>

              {/* Medical */}
              <div>
                <SectionHeader icon={<Pill className="w-4 h-4" />} title="Medical Details" />
                {conditions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Conditions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {conditions.map(c => <Badge key={c} variant="secondary" className="bg-red-50 text-red-700 border-red-200 text-xs">{c}</Badge>)}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ViewField label="Medications" value={profile?.medications || "None listed"} />
                  <ViewField label="Allergies" value={profile?.allergies || "None listed"} />
                </div>
              </div>

              {/* Lifestyle */}
              <div>
                <SectionHeader icon={<Dumbbell className="w-4 h-4" />} title="Lifestyle & Goals" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <ViewField label="Sleep" value={profile?.sleepHours ? `${profile.sleepHours} hrs/night` : null} />
                  <ViewField label="Activity Level" value={profile?.activityLevel ? (activityLabels[profile.activityLevel] ?? profile.activityLevel) : null} />
                  <ViewField label="Health Goals" value={profile?.goals} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Details from Documents */}
          {parsedAdditional && Object.keys(parsedAdditional).length > 0 && (
            <Card className="border-teal-200 shadow-sm bg-teal-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-teal-800">
                  <FileText className="w-4 h-4 text-teal-600" />Additional Details from Medical Documents
                </CardTitle>
                <CardDescription className="text-xs text-teal-700">Data extracted automatically from your uploaded reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(parsedAdditional).filter(([k]) => k !== "summary").map(([key, val]) => {
                    const displayVal = Array.isArray(val)
                      ? (val as unknown[]).map(v => typeof v === "object" ? JSON.stringify(v) : String(v)).join(", ")
                      : typeof val === "object"
                      ? JSON.stringify(val)
                      : String(val);
                    if (!displayVal) return null;
                    return (
                      <div key={key}>
                        <p className="text-xs font-medium text-teal-600 uppercase tracking-wide mb-0.5 capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </p>
                        <p className="text-sm text-slate-800">{displayVal}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Document Upload (view mode) */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Upload className="w-4 h-4 text-teal-600" />Medical Documents</CardTitle>
              <CardDescription className="text-xs">Upload lab reports or health records — AI extracts the data automatically</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUploadPanel onExtracted={handleDocExtracted} />
            </CardContent>
          </Card>

          <p className="text-xs text-center text-slate-400 pb-4">
            This information is used to personalize your AI health guidance. Only you can see it.
          </p>
        </div>
      )}
    </div>
  );
}
