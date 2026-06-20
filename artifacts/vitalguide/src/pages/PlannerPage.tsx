import { useState } from "react";
import { useListPlans, useCreatePlan, useGetTodayLog, useCreateLog, useListConversations, useCreateConversation, useGetConversationMessages, getGetTodayLogQueryKey, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarHeart, Plus, Activity, Bot, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ChatInterface from "@/components/chat/ChatInterface";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const planSchema = z.object({
  title: z.string().min(2),
  type: z.string(),
  description: z.string().optional(),
});

const logSchema = z.object({
  mood: z.string().optional(),
  sleepHours: z.coerce.number().optional(),
  waterIntake: z.coerce.number().optional(),
  foodLog: z.string().optional(),
  notes: z.string().optional(),
});

export default function PlannerPage() {
  const { data: plans } = useListPlans();
  const { data: todayLog } = useGetTodayLog({ query: { retry: false, queryKey: getGetTodayLogQueryKey() } });
  const { data: convos } = useListConversations();
  const createPlan = useCreatePlan();
  const createLog = useCreateLog();
  const createConversation = useCreateConversation();
  const { toast } = useToast();
  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);

  const plannerConvos = convos?.filter(c => c.mode === "planner") || [];
  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);

  const planForm = useForm<z.infer<typeof planSchema>>({
    resolver: zodResolver(planSchema),
    defaultValues: { title: "", type: "custom", description: "" }
  });

  const logForm = useForm<z.infer<typeof logSchema>>({
    resolver: zodResolver(logSchema),
    defaultValues: { mood: "", sleepHours: undefined, waterIntake: undefined, foodLog: "", notes: "" }
  });

  const onPlanSubmit = (data: z.infer<typeof planSchema>) => {
    createPlan.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Plan created", description: "Your new health plan is active." });
        setIsAddPlanOpen(false);
        planForm.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      }
    });
  };

  const onLogSubmit = (data: z.infer<typeof logSchema>) => {
    createLog.mutate({ data: { ...data, logDate: new Date().toISOString() } }, {
      onSuccess: () => {
        toast({ title: "Log saved", description: "Your daily check-in is complete." });
        queryClient.invalidateQueries({ queryKey: ["/api/logs/today"] });
      }
    });
  };

  const startAssistant = () => {
    createConversation.mutate({ data: { mode: "planner", title: "Planner Assistant" } }, {
      onSuccess: (data) => {
        setActiveConvoId(data.id);
        queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      }
    });
  };

  if (!activeConvoId && plannerConvos.length > 0) {
    setActiveConvoId(plannerConvos[plannerConvos.length - 1].id);
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      medication: "bg-red-50 text-red-700 border-red-200",
      diet: "bg-orange-50 text-orange-700 border-orange-200",
      fitness: "bg-blue-50 text-blue-700 border-blue-200",
      recovery: "bg-indigo-50 text-indigo-700 border-indigo-200",
      custom: "bg-slate-100 text-slate-700 border-slate-200",
    };
    return colors[type] || colors.custom;
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      
      {/* Left Column: Plans & Logs */}
      <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
              <CalendarHeart className="w-6 h-6 text-blue-700" />
              Plan Tracker
            </h1>
            <p className="text-sm text-slate-500 mt-1">Manage plans and daily progress</p>
          </div>
          
          <Dialog open={isAddPlanOpen} onOpenChange={setIsAddPlanOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2" /> Add Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Create New Plan</DialogTitle>
              </DialogHeader>
              <Form {...planForm}>
                <form onSubmit={planForm.handleSubmit(onPlanSubmit)} className="space-y-5 pt-4">
                  <FormField control={planForm.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Title</FormLabel>
                      <FormControl><Input className="h-11" placeholder="e.g. Daily Vitamins" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={planForm.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="medication">Medication</SelectItem>
                          <SelectItem value="diet">Diet & Nutrition</SelectItem>
                          <SelectItem value="fitness">Fitness & Exercise</SelectItem>
                          <SelectItem value="recovery">Rest & Recovery</SelectItem>
                          <SelectItem value="custom">Custom Goal</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={planForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Details / Notes</FormLabel>
                      <FormControl><Textarea className="resize-none min-h-[100px]" placeholder="Specific instructions..." {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base mt-2" disabled={createPlan.isPending}>
                    {createPlan.isPending ? "Saving..." : "Save Plan"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Active Plans Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Your Active Plans</h2>
          {plans?.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
              <CalendarHeart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-slate-700 font-medium">No active plans</h3>
              <p className="text-sm text-slate-500 mt-1">Create a plan to start tracking your health goals.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans?.map(p => (
                <Card key={p.id} className="shadow-sm border-slate-200 overflow-hidden">
                  <div className="h-1.5 w-full bg-slate-100" />
                  <CardHeader className="p-5 pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className={`capitalize font-medium ${getTypeColor(p.type)}`}>
                        {p.type}
                      </Badge>
                      <Badge variant="secondary" className={p.status === "active" ? "bg-emerald-50 text-emerald-700" : ""}>
                        {p.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-semibold leading-tight">{p.title}</CardTitle>
                  </CardHeader>
                  {p.description && (
                    <CardContent className="p-5 pt-0">
                      <p className="text-sm text-slate-600 line-clamp-3">{p.description}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Today's Log Section */}
        <section className="pt-6 border-t border-slate-200 pb-8">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Daily Check-in</h2>
          </div>
          
          {todayLog ? (
            <Card className="bg-emerald-50/50 border-emerald-100 shadow-sm">
              <CardContent className="p-8 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-emerald-900 mb-2">You've logged your day</h3>
                <p className="text-emerald-700/80">Great job staying consistent with your health tracking. See you tomorrow!</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm border-slate-200">
              <CardContent className="p-6 md:p-8">
                <Form {...logForm}>
                  <form onSubmit={logForm.handleSubmit(onLogSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField control={logForm.control} name="mood" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-medium text-slate-700">How are you feeling?</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="h-11 bg-slate-50"><SelectValue placeholder="Select mood" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="great">Great 🌟</SelectItem>
                              <SelectItem value="good">Good 🙂</SelectItem>
                              <SelectItem value="okay">Okay 😐</SelectItem>
                              <SelectItem value="bad">Bad 😔</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={logForm.control} name="sleepHours" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-medium text-slate-700">Sleep (Hours)</FormLabel>
                          <FormControl><Input className="h-11 bg-slate-50" type="number" {...field} value={field.value || ""} placeholder="e.g. 8" /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={logForm.control} name="waterIntake" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-medium text-slate-700">Water (Glasses)</FormLabel>
                          <FormControl><Input className="h-11 bg-slate-50" type="number" {...field} value={field.value || ""} placeholder="e.g. 5" /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={logForm.control} name="foodLog" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-medium text-slate-700">Food & Diet</FormLabel>
                          <FormControl><Textarea className="resize-none min-h-[100px] bg-slate-50" placeholder="Briefly describe your meals today..." {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={logForm.control} name="notes" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-medium text-slate-700">Notes & Symptoms</FormLabel>
                          <FormControl><Textarea className="resize-none min-h-[100px] bg-slate-50" placeholder="Any noticeable symptoms, workout details, or general notes?" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    
                    <div className="pt-2">
                      <Button type="submit" className="w-full md:w-auto px-8 bg-teal-600 hover:bg-teal-700 h-11 text-base shadow-sm" disabled={createLog.isPending}>
                        {createLog.isPending ? "Saving..." : "Complete Daily Check-in"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      {/* Right Column: Assistant Chat */}
      <div className="w-full lg:w-[350px] flex-shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 h-[500px] lg:h-full overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Planner Assistant</h3>
              <p className="text-[11px] text-slate-500 font-medium">Ask for routine suggestions</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {activeConvoId ? (
            <PlannerChat conversationId={activeConvoId} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white">
              <Bot className="w-12 h-12 text-slate-200 mb-4" />
              <h4 className="text-slate-700 font-medium mb-2">Need help planning?</h4>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                The assistant can help you design a diet plan, optimize your sleep schedule, or suggest workout routines.
              </p>
              <Button onClick={startAssistant} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm w-full">
                Start Assistant
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlannerChat({ conversationId }: { conversationId: number }) {
  const { data: messages } = useGetConversationMessages(conversationId, {
    query: { enabled: !!conversationId, queryKey: getGetConversationMessagesQueryKey(conversationId) }
  });
  return <ChatInterface conversationId={conversationId} initialMessages={messages || []} mode="planner" />;
}
