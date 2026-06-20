import { useState } from "react";
import { useLocation } from "wouter";
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
import { HeartPulse, ArrowRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const step1Schema = z.object({
  name: z.string().min(2, "Name is required"),
  age: z.coerce.number().min(1, "Must be at least 1"),
  gender: z.string().optional(),
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

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const upsertProfile = useUpsertProfile();

  const form = useForm<FormValues>({
    resolver: zodResolver(
      step === 1 ? step1Schema : step === 2 ? step2Schema : fullSchema
    ),
    defaultValues: {
      name: "", age: undefined, gender: "", weight: undefined, height: undefined,
      medicalConditions: "", medications: "", allergies: "",
      sleepHours: 8, activityLevel: "", goals: "", location: ""
    },
    mode: "onSubmit",
  });

  const onSubmit = async (data: FormValues) => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    upsertProfile.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Profile complete", description: "Welcome to VitalGuide." });
        setLocation("/dashboard");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 text-teal-700 font-semibold text-xl mb-8 justify-center">
          <HeartPulse className="w-7 h-7" />
          VitalGuide
        </div>

        <Card className="shadow-lg border-slate-200 overflow-hidden">
          <div className="bg-white px-8 pt-8 pb-4 border-b border-slate-100">
            <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
              Let's set up your profile
            </CardTitle>
            <CardDescription className="text-slate-500 text-base">
              Personalizing your health companion helps provide better guidance.
            </CardDescription>
            <div className="mt-6">
              <div className="flex justify-between text-xs font-medium text-slate-500 mb-2 px-1">
                <span>Basics</span>
                <span>Medical</span>
                <span>Lifestyle</span>
              </div>
              <Progress value={(step / 3) * 100} className="h-1.5 bg-slate-100" />
            </div>
          </div>

          <CardContent className="p-8 bg-white">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {step === 1 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Full Name</FormLabel>
                        <FormControl><Input className="bg-slate-50 border-slate-200 h-11" {...field} placeholder="John Doe" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-5">
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
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-5">
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
                        <FormControl><Textarea className="bg-slate-50 border-slate-200 resize-none min-h-[80px]" {...field} placeholder="e.g. Asthma, Hypertension" /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="medications" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Current Medications (Optional)</FormLabel>
                        <FormControl><Textarea className="bg-slate-50 border-slate-200 resize-none min-h-[80px]" {...field} placeholder="e.g. Albuterol inhaler" /></FormControl>
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
                    <div className="grid grid-cols-2 gap-5">
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
                              <SelectItem value="active">Very Active</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="goals" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Health Goals</FormLabel>
                        <FormControl><Textarea className="bg-slate-50 border-slate-200 resize-none min-h-[80px]" {...field} placeholder="e.g. Improve stamina, sleep better" /></FormControl>
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

                <div className="flex items-center justify-between pt-4 mt-8 border-t border-slate-100">
                  {step > 1 ? (
                    <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} className="text-slate-500 hover:text-slate-800">
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                  ) : <div />}
                  <Button 
                    type="submit" 
                    className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm px-8" 
                    disabled={upsertProfile.isPending}
                  >
                    {step === 3 ? (upsertProfile.isPending ? "Saving..." : "Complete Profile") : (
                      <>Next Step <ArrowRight className="w-4 h-4 ml-2" /></>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
