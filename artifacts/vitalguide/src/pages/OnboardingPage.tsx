import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpsertProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  HeartPulse, ArrowRight, ArrowLeft, Upload, FileText, Loader2,
  CheckCircle2, SkipForward, Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const MEDICAL_CONDITIONS = [
  "Diabetes (Type 1)", "Diabetes (Type 2)", "Hypertension", "Hypotension",
  "Asthma", "COPD", "Obesity", "Heart Disease", "Stroke (History)",
  "Arthritis", "Thyroid Disorder", "PCOS / PCOD", "Kidney Disease",
  "Liver Disease", "Cancer", "Depression", "Anxiety", "Epilepsy / Seizures",
  "Chickenpox (History)", "Tuberculosis (History)", "COVID-19 (History)",
  "Anaemia", "High Cholesterol", "Migraine", "Sleep Apnea", "Other",
];

function ConditionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected: string[] = value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];
  const toggle = (condition: string) => {
    const next = selected.includes(condition)
      ? selected.filter(c => c !== condition)
      : [...selected, condition];
    onChange(next.join(", "));
  };
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-44 overflow-y-auto">
      {MEDICAL_CONDITIONS.map(c => (
        <button key={c} type="button" onClick={() => toggle(c)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            selected.includes(c)
              ? "bg-teal-600 text-white border-teal-600"
              : "bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-700"
          }`}
        >{c}</button>
      ))}
    </div>
  );
}

const step1Schema = z.object({
  name: z.string().min(2, "Name is required"),
  age: z.coerce.number().min(1, "Must be at least 1").max(120),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
});

const step2Schema = z.object({
  weight: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  medicalConditions: z.string().optional(),
  medications: z.string().optional(),
  allergies: z.string().optional(),
});

const step3Schema = z.object({
  sleepHours: z.coerce.number().optional(),
  activityLevel: z.string().optional(),
  goals: z.string().optional(),
  location: z.string().optional(),
});

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema);
type FormValues = z.infer<typeof fullSchema>;

const TOTAL_STEPS = 4;

const STEP_LABELS = ["Basics", "Medical", "Lifestyle", "Documents"];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();
  const upsertProfile = useUpsertProfile();

  const [docUploading, setDocUploading] = useState(false);
  const [docResult, setDocResult] = useState<{
    filename: string;
    summary: string | null;
    extractedData: Record<string, unknown> | null;
    profileUpdated: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(
      step === 1 ? step1Schema :
      step === 2 ? step2Schema :
      step === 3 ? step3Schema :
      fullSchema
    ),
    defaultValues: {
      name: user?.fullName ?? user?.firstName ?? "",
      age: undefined,
      gender: "",
      bloodGroup: "",
      weight: undefined,
      height: undefined,
      medicalConditions: "",
      medications: "",
      allergies: "",
      sleepHours: 8,
      activityLevel: "",
      goals: "",
      location: "",
    },
    mode: "onSubmit",
  });

  const saveProfile = (data: FormValues, additionalDetails?: Record<string, unknown>) => {
    upsertProfile.mutate({
      data: {
        ...data,
        age: Number(data.age),
        weight: data.weight ? Number(data.weight) : undefined,
        height: data.height ? Number(data.height) : undefined,
        sleepHours: data.sleepHours ? Number(data.sleepHours) : undefined,
        additionalDetails: additionalDetails ? JSON.stringify(additionalDetails) : undefined,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Profile complete", description: "Welcome to VitalGuide." });
        setLocation("/dashboard");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
      }
    });
  };

  const onSubmit = async (data: FormValues) => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    saveProfile(data, docResult?.extractedData ?? undefined);
  };

  const handleSkipAndFinish = () => {
    saveProfile(form.getValues(), docResult?.extractedData ?? undefined);
  };

  const handleDocUpload = async (file: File) => {
    setDocUploading(true);
    const formData = new FormData();
    formData.append("document", file);
    formData.append("belongsToUser", "true");
    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const doc = await res.json();
      setDocResult(doc);

      const extracted = doc.extractedData as Record<string, unknown> | null;
      if (extracted) {
        if (extracted.bloodGroup && !form.getValues("bloodGroup")) {
          form.setValue("bloodGroup", extracted.bloodGroup as string);
        }
        if (extracted.diagnoses && !form.getValues("medicalConditions")) {
          const conditions = Array.isArray(extracted.diagnoses)
            ? (extracted.diagnoses as string[]).join(", ")
            : String(extracted.diagnoses);
          form.setValue("medicalConditions", conditions);
        }
        if (extracted.medications && !form.getValues("medications")) {
          const meds = Array.isArray(extracted.medications)
            ? (extracted.medications as unknown[]).map(m => typeof m === "object" ? JSON.stringify(m) : String(m)).join(", ")
            : String(extracted.medications);
          form.setValue("medications", meds);
        }
        if (extracted.allergies && !form.getValues("allergies")) {
          const alg = Array.isArray(extracted.allergies)
            ? (extracted.allergies as string[]).join(", ")
            : String(extracted.allergies);
          form.setValue("allergies", alg);
        }
      }

      toast({
        title: "Document scanned",
        description: doc.profileUpdated
          ? "Your profile has been pre-filled from the document."
          : "Document saved. Review the extracted info below.",
      });
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setDocUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-6 font-sans">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 text-teal-700 font-semibold text-xl mb-6 justify-center">
          <HeartPulse className="w-7 h-7" />
          VitalGuide
        </div>

        <Card className="shadow-lg border-slate-200 overflow-hidden">
          <div className="bg-white px-6 md:px-8 pt-6 md:pt-8 pb-4 border-b border-slate-100">
            <CardTitle className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-2">
              Let's set up your profile
            </CardTitle>
            <CardDescription className="text-slate-500 text-sm md:text-base">
              Personalizing your health companion helps provide better guidance.
            </CardDescription>
            <div className="mt-5">
              <div className="flex justify-between text-xs font-medium text-slate-400 mb-2 px-0.5">
                {STEP_LABELS.map((label, i) => (
                  <span key={label} className={step === i + 1 ? "text-teal-700 font-semibold" : ""}>{label}</span>
                ))}
              </div>
              <Progress value={(step / TOTAL_STEPS) * 100} className="h-1.5 bg-slate-100" />
            </div>
          </div>

          <CardContent className="p-6 md:p-8 bg-white">
            {user?.primaryEmailAddress && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-6 border border-slate-100">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Signed in as <span className="font-medium text-slate-700">{user.primaryEmailAddress.emailAddress}</span></span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {step === 1 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Full Name</FormLabel>
                        <FormControl><Input className="bg-slate-50 border-slate-200 h-11" {...field} placeholder="John Doe" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="age" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Age</FormLabel>
                          <FormControl><Input className="bg-slate-50 border-slate-200 h-11" type="number" {...field} value={field.value || ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Gender</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-slate-50 border-slate-200 h-11">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="bloodGroup" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Blood Group (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-slate-50 border-slate-200 h-11">
                              <SelectValue placeholder="Select blood group" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BLOOD_GROUPS.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="weight" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Weight (kg)</FormLabel>
                          <FormControl><Input className="bg-slate-50 border-slate-200 h-11" type="number" {...field} value={field.value || ""} placeholder="e.g. 70" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="height" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Height (cm)</FormLabel>
                          <FormControl><Input className="bg-slate-50 border-slate-200 h-11" type="number" {...field} value={field.value || ""} placeholder="e.g. 175" /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="medicalConditions" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Medical Conditions (Optional)</FormLabel>
                        <FormControl>
                          <ConditionPicker value={field.value ?? ""} onChange={field.onChange} />
                        </FormControl>
                        <p className="text-xs text-slate-400 mt-1">Tap to select all that apply</p>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="medications" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Current Medications (Optional)</FormLabel>
                        <FormControl><Textarea className="bg-slate-50 border-slate-200 resize-none min-h-[70px]" {...field} placeholder="e.g. Albuterol inhaler, Metformin 500mg" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="allergies" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Allergies (Optional)</FormLabel>
                        <FormControl><Input className="bg-slate-50 border-slate-200 h-11" {...field} placeholder="e.g. Peanuts, Penicillin" /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="sleepHours" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Sleep (Hours)</FormLabel>
                          <FormControl><Input className="bg-slate-50 border-slate-200 h-11" type="number" {...field} value={field.value || ""} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="activityLevel" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Activity Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-slate-50 border-slate-200 h-11">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="sedentary">Sedentary</SelectItem>
                              <SelectItem value="light">Lightly Active</SelectItem>
                              <SelectItem value="moderate">Moderately Active</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="very_active">Very Active</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="goals" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Health Goals</FormLabel>
                        <FormControl><Textarea className="bg-slate-50 border-slate-200 resize-none min-h-[70px]" {...field} placeholder="e.g. Improve stamina, sleep better, manage diabetes" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="location" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Location / City</FormLabel>
                        <FormControl><Input className="bg-slate-50 border-slate-200 h-11" {...field} placeholder="e.g. San Francisco" /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800 mb-1">Upload a Medical Document</h3>
                      <p className="text-sm text-slate-500 mb-4">
                        Upload a lab report, prescription, or health record. Our AI will scan it and automatically fill in relevant health details — like blood group, diagnoses, vitals, and medications.
                      </p>

                      {!docResult ? (
                        <div
                          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-300 hover:bg-teal-50/30 transition-all"
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            e.preventDefault();
                            const f = e.dataTransfer.files[0];
                            if (f) handleDocUpload(f);
                          }}
                          onClick={() => fileRef.current?.click()}
                        >
                          <input
                            ref={fileRef} type="file" className="hidden"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); }}
                          />
                          {docUploading ? (
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
                              <p className="text-sm text-slate-600 font-medium">Scanning with AI…</p>
                              <p className="text-xs text-slate-400">Extracting health data from your document</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <Upload className="w-10 h-10 text-slate-300" />
                              <p className="text-sm font-medium text-slate-700">Drop your document here, or click to browse</p>
                              <p className="text-xs text-slate-400">JPEG, PNG, WebP — lab reports, prescriptions, health records</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-teal-900">Document scanned successfully</p>
                              <p className="text-xs text-teal-700 truncate mt-0.5">{docResult.filename}</p>
                            </div>
                          </div>
                          {docResult.summary && (
                            <p className="text-xs text-slate-600 bg-white rounded-lg p-3 border border-teal-100">
                              {docResult.summary}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-xs">
                              {docResult.profileUpdated ? "Profile auto-filled" : "Data extracted"}
                            </Badge>
                            <button
                              type="button"
                              onClick={() => { setDocResult(null); if (fileRef.current) fileRef.current.value = ""; }}
                              className="text-xs text-slate-400 hover:text-slate-700 underline"
                            >
                              Upload different
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <p className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700">Optional step.</span> You can always upload documents later from your Profile page. Uploading now helps the AI give more personalized guidance from day one.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 mt-6 border-t border-slate-100">
                  {step > 1 ? (
                    <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} className="text-slate-500 hover:text-slate-800">
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    {step === 4 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleSkipAndFinish}
                        disabled={upsertProfile.isPending}
                        className="text-slate-400 hover:text-slate-600 gap-1 text-sm"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        {docResult ? "Finish" : "Skip for now"}
                      </Button>
                    )}
                    {step < 4 && (
                      <Button
                        type="submit"
                        className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm px-6"
                        disabled={upsertProfile.isPending}
                      >
                        Next Step <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                    {step === 4 && docResult && (
                      <Button
                        type="submit"
                        className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm px-6"
                        disabled={upsertProfile.isPending}
                      >
                        {upsertProfile.isPending ? "Saving…" : "Complete Profile"}
                        {!upsertProfile.isPending && <CheckCircle2 className="w-4 h-4 ml-2" />}
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
