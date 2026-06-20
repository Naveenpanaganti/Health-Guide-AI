import { useState } from "react";
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
import { User, Pencil, X, Save, Heart, Pill, Dumbbell, Moon, MapPin, Target } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.coerce.number().min(1).max(120),
  gender: z.string().optional(),
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

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-800">{value}</p>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <span className="text-teal-600">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { data: profile, isLoading } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey() },
  });
  const upsertProfile = useUpsertProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile
      ? {
          name: profile.name,
          age: profile.age,
          gender: profile.gender ?? "",
          weight: profile.weight ?? undefined,
          height: profile.height ?? undefined,
          medicalConditions: profile.medicalConditions ?? "",
          medications: profile.medications ?? "",
          allergies: profile.allergies ?? "",
          sleepHours: profile.sleepHours ?? undefined,
          activityLevel: profile.activityLevel ?? "",
          goals: profile.goals ?? "",
          location: profile.location ?? "",
        }
      : undefined,
  });

  const onSubmit = (data: ProfileForm) => {
    upsertProfile.mutate(
      { data: { ...data, age: Number(data.age) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          setEditing(false);
          toast({ title: "Profile updated", description: "Your health profile has been saved." });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to save profile. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const activityLabels: Record<string, string> = {
    sedentary: "Sedentary",
    light: "Lightly Active",
    moderate: "Moderately Active",
    active: "Active",
    very_active: "Very Active",
  };

  const genderLabels: Record<string, string> = {
    male: "Male",
    female: "Female",
    other: "Other",
    prefer_not_to_say: "Prefer not to say",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="gap-2 border-slate-200"
          >
            <Pencil className="w-4 h-4" />
            Edit Profile
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEditing(false); form.reset(); }}
            className="gap-2 text-slate-500"
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
        )}
      </div>

      {editing ? (
        /* ─── EDIT MODE ─── */
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-teal-600" />Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} placeholder="Your name" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} placeholder="Age" /></FormControl><FormMessage /></FormItem>
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
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} placeholder="City, Country" /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2"><Heart className="w-4 h-4 text-teal-600" />Physical Stats</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="weight" render={({ field }) => (
                  <FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input type="number" step="0.1" {...field} placeholder="e.g. 70" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="height" render={({ field }) => (
                  <FormItem><FormLabel>Height (cm)</FormLabel><FormControl><Input type="number" {...field} placeholder="e.g. 175" /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2"><Pill className="w-4 h-4 text-teal-600" />Medical Details</CardTitle>
                <CardDescription className="text-xs">This information personalizes your AI health guidance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={form.control} name="medicalConditions" render={({ field }) => (
                  <FormItem><FormLabel>Medical Conditions</FormLabel><FormControl><Textarea {...field} placeholder="e.g. Type 2 diabetes, hypertension" rows={2} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="medications" render={({ field }) => (
                  <FormItem><FormLabel>Current Medications</FormLabel><FormControl><Textarea {...field} placeholder="e.g. Metformin 500mg twice daily" rows={2} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="allergies" render={({ field }) => (
                  <FormItem><FormLabel>Allergies</FormLabel><FormControl><Textarea {...field} placeholder="e.g. Penicillin, peanuts" rows={2} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2"><Dumbbell className="w-4 h-4 text-teal-600" />Lifestyle & Goals</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="sleepHours" render={({ field }) => (
                  <FormItem><FormLabel>Sleep (hours/night)</FormLabel><FormControl><Input type="number" step="0.5" {...field} placeholder="e.g. 7.5" /></FormControl><FormMessage /></FormItem>
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
                    <FormItem><FormLabel>Health Goals</FormLabel><FormControl><Textarea {...field} placeholder="e.g. Lose 5kg, manage blood sugar, sleep better" rows={2} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
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
        /* ─── VIEW MODE ─── */
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-6 space-y-6">
              <Section icon={<User className="w-4 h-4" />} title="Basic Information">
                <Field label="Full Name" value={profile?.name} />
                <Field label="Age" value={profile?.age ? `${profile.age} years` : null} />
                <Field label="Gender" value={profile?.gender ? (genderLabels[profile.gender] ?? profile.gender) : null} />
                <Field label="Location" value={profile?.location} />
              </Section>

              <Section icon={<Heart className="w-4 h-4" />} title="Physical Stats">
                <Field label="Weight" value={profile?.weight ? `${profile.weight} kg` : null} />
                <Field label="Height" value={profile?.height ? `${profile.height} cm` : null} />
                {profile?.weight && profile?.height && (
                  <Field
                    label="BMI"
                    value={`${(profile.weight / Math.pow(profile.height / 100, 2)).toFixed(1)}`}
                  />
                )}
              </Section>

              <Section icon={<Pill className="w-4 h-4" />} title="Medical Details">
                <div className="col-span-2 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Medical Conditions" value={profile?.medicalConditions || "None listed"} />
                  <Field label="Current Medications" value={profile?.medications || "None listed"} />
                  <Field label="Allergies" value={profile?.allergies || "None listed"} />
                </div>
              </Section>

              <Section icon={<Dumbbell className="w-4 h-4" />} title="Lifestyle & Goals">
                <Field label="Sleep" value={profile?.sleepHours ? `${profile.sleepHours} hrs / night` : null} />
                <Field
                  label="Activity Level"
                  value={profile?.activityLevel ? (activityLabels[profile.activityLevel] ?? profile.activityLevel) : null}
                />
                <div className="col-span-2 md:col-span-1">
                  <Field label="Health Goals" value={profile?.goals} />
                </div>
              </Section>
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
