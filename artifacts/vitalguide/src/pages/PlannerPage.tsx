import { useState, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { useListPlans, useCreatePlan, useGetTodayLog, useListConversations, useCreateConversation, useGetConversationMessages, getGetTodayLogQueryKey, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarHeart, Plus, Activity, Bot, CheckCircle2, Clock, CalendarDays, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ChatInterface from "@/components/chat/ChatInterface";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TodayLogModal, { type DailyLog } from "@/components/log/TodayLogModal";
import LogCalendar from "@/components/log/LogCalendar";

const planSchema = z.object({
  title: z.string().min(2),
  type: z.string(),
  description: z.string().optional(),
});

export default function PlannerPage() {
  const { data: plans } = useListPlans();
  const { data: todayLog, refetch: refetchTodayLog } = useGetTodayLog({ query: { retry: false, queryKey: getGetTodayLogQueryKey() } });
  const { data: convos } = useListConversations();
  const createPlan = useCreatePlan();
  const createConversation = useCreateConversation();
  const { getToken } = useAuth();
  const { toast } = useToast();

  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calRefresh, setCalRefresh] = useState(0);

  // Today's Log Modal
  const [logOpen, setLogOpen] = useState(false);
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);

  const plannerConvos = convos?.filter(c => c.mode === "planner") || [];
  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);

  const planForm = useForm<z.infer<typeof planSchema>>({
    resolver: zodResolver(planSchema),
    defaultValues: { title: "", type: "custom", description: "" }
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

  const openLogForDate = useCallback(async (date: string) => {
    setLogDate(date);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const isToday = date === new Date().toISOString().split("T")[0];
      const url = isToday ? "/api/logs/today" : `/api/logs/date/${date}`;
      const res = await fetch(url, { headers });
      if (res.ok) setSelectedLog(await res.json());
      else setSelectedLog(null);
    } catch { setSelectedLog(null); }
    setLogOpen(true);
  }, [getToken]);

  const openTodayLog = () => openLogForDate(new Date().toISOString().split("T")[0]);

  const handleLogSaved = (log: DailyLog) => {
    setSelectedLog(log);
    refetchTodayLog();
    queryClient.invalidateQueries({ queryKey: getGetTodayLogQueryKey() });
    setCalRefresh(n => n + 1);
  };

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

  const isCompleted = !!(todayLog as DailyLog | undefined)?.isCompleted;
  const hasLog = !!todayLog;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">

      {/* Left Column */}
      <div className="flex-1 overflow-y-auto space-y-7 pr-2 custom-scrollbar">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
              <CalendarHeart className="w-6 h-6 text-blue-700" />
              Plan Tracker
            </h1>
            <p className="text-sm text-slate-500 mt-1">Manage plans, daily logs and past days</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 border-slate-200" onClick={() => setShowCalendar(p => !p)}>
              <CalendarDays size={14} /> {showCalendar ? "Hide" : "Calendar"}
            </Button>
            <Dialog open={isAddPlanOpen} onOpenChange={setIsAddPlanOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" size="sm">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Plan
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
        </div>

        {/* Today's Daily Check-in Banner */}
        <button onClick={openTodayLog} className="w-full text-left group">
          <Card className={`border-2 transition-all duration-200 ${isCompleted ? "border-emerald-200 bg-emerald-50/60" : "border-teal-200 bg-teal-50/60 group-hover:border-teal-300 group-hover:bg-teal-50"}`}>
            <CardContent className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isCompleted ? "bg-emerald-100" : "bg-teal-100"}`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Activity className="w-5 h-5 text-teal-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">Today's Daily Log</span>
                      {isCompleted
                        ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-0.5 py-0"><CheckCircle2 size={9} /> Completed</Badge>
                        : <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] gap-0.5 py-0 animate-pulse"><Clock size={9} /> In Progress until midnight</Badge>
                      }
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isCompleted ? "Daily check-in is complete." : hasLog ? "Continue filling in your log." : "Tap to start your daily health log."}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Calendar */}
        {showCalendar && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <CalendarDays size={14} className="text-slate-500" /> Log History
            </h2>
            <LogCalendar
              selectedDate={logDate}
              onSelectDate={(date) => openLogForDate(date)}
              refreshTrigger={calRefresh}
            />
            <p className="text-xs text-slate-400 mt-2 text-center">Click any past date to review or edit that day's log</p>
          </section>
        )}

        {/* Active Plans */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">Your Active Plans</h2>
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
                      <Badge variant="outline" className={`capitalize font-medium ${getTypeColor(p.type)}`}>{p.type}</Badge>
                      <Badge variant="secondary" className={p.status === "active" ? "bg-emerald-50 text-emerald-700" : ""}>{p.status}</Badge>
                    </div>
                    <CardTitle className="text-base font-semibold leading-tight">{p.title}</CardTitle>
                    {p.description && <p className="text-sm text-slate-600 mt-1 line-clamp-2">{p.description}</p>}
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="pb-8" />
      </div>

      {/* Right Column: Assistant */}
      <div className="w-full lg:w-[340px] flex-shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 h-[500px] lg:h-full overflow-hidden flex flex-col">
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
                The assistant can help design a diet plan, optimize your sleep schedule, or suggest workout routines.
              </p>
              <Button onClick={startAssistant} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm w-full">
                Start Assistant
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Today's Log Modal */}
      <TodayLogModal
        open={logOpen}
        onOpenChange={setLogOpen}
        date={logDate}
        initialLog={selectedLog}
        onSaved={handleLogSaved}
      />
    </div>
  );
}

function PlannerChat({ conversationId }: { conversationId: number }) {
  const { data: messages } = useGetConversationMessages(conversationId, {
    query: { enabled: !!conversationId, queryKey: getGetConversationMessagesQueryKey(conversationId) }
  });
  return <ChatInterface conversationId={conversationId} initialMessages={messages || []} mode="planner" />;
}
