import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListPlans, useCreatePlan, useGetTodayLog, useListConversations, useCreateConversation, useGetConversationMessages, getGetTodayLogQueryKey, getGetConversationMessagesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  CalendarHeart, Plus, Activity, Bot, CheckCircle2, Clock, CalendarDays,
  ChevronRight, Pill, Dumbbell, Salad, BedDouble, Target,
  Droplets, Apple, Moon, Flame, AlertCircle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ChatInterface from "@/components/chat/ChatInterface";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import TodayLogModal, { type DailyLog } from "@/components/log/TodayLogModal";
import LogCalendar from "@/components/log/LogCalendar";
import { cn } from "@/lib/utils";

const planSchema = z.object({
  title: z.string().min(2),
  type: z.string(),
  description: z.string().optional(),
});

// ── Plan type config ───────────────────────────────────────────────────────────
const PLAN_TYPE_CONFIG: Record<string, {
  icon: React.ReactNode; color: string; badgeColor: string;
  tasks: string[]; emoji: string;
}> = {
  medication: {
    icon: <Pill className="w-4 h-4" />,
    color: "from-red-50 to-rose-50 border-red-200",
    badgeColor: "bg-red-50 text-red-700 border-red-200",
    tasks: ["💊 Take prescribed medications", "📝 Note any side effects", "⏰ Stay on schedule"],
    emoji: "💊",
  },
  diet: {
    icon: <Salad className="w-4 h-4" />,
    color: "from-orange-50 to-amber-50 border-orange-200",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
    tasks: ["🥗 Log all meals today", "💧 Stay hydrated (8+ glasses)", "🍎 Eat balanced portions"],
    emoji: "🥗",
  },
  fitness: {
    icon: <Dumbbell className="w-4 h-4" />,
    color: "from-blue-50 to-indigo-50 border-blue-200",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    tasks: ["🏃 Complete today's workout", "📊 Track activity duration", "🧘 Cool down & stretch"],
    emoji: "🏃",
  },
  recovery: {
    icon: <BedDouble className="w-4 h-4" />,
    color: "from-indigo-50 to-purple-50 border-indigo-200",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    tasks: ["😴 Get 7–9 hours of sleep", "🧘 Limit strenuous activity", "🫀 Listen to your body"],
    emoji: "😴",
  },
  custom: {
    icon: <Target className="w-4 h-4" />,
    color: "from-slate-50 to-zinc-50 border-slate-200",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
    tasks: ["✅ Follow your plan guidelines", "📓 Log progress today"],
    emoji: "🎯",
  },
};

// ── Reminder icons ─────────────────────────────────────────────────────────────
const REMINDER_ITEMS = [
  { icon: <Pill className="w-4 h-4 text-red-500" />, text: "Take medications on time", types: ["medication"] },
  { icon: <Dumbbell className="w-4 h-4 text-blue-500" />, text: "Complete today's workout", types: ["fitness"] },
  { icon: <Apple className="w-4 h-4 text-orange-500" />, text: "Log all your meals", types: ["diet"] },
  { icon: <Droplets className="w-4 h-4 text-cyan-500" />, text: "Drink 8+ glasses of water", types: ["diet", "fitness", "medication"] },
  { icon: <Moon className="w-4 h-4 text-indigo-500" />, text: "Aim to sleep by 10:30 PM", types: ["recovery", "fitness"] },
  { icon: <Flame className="w-4 h-4 text-amber-500" />, text: "Track your calories / meals", types: ["diet"] },
  { icon: <BedDouble className="w-4 h-4 text-purple-500" />, text: "Rest and avoid overexertion", types: ["recovery"] },
];

// ── Streak / progress helpers ──────────────────────────────────────────────────
function WeekDots({ loggedDates, completed }: { loggedDates: Set<string>; completed: Set<string> }) {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return (
    <div className="flex items-center gap-1">
      {days.map(d => {
        const done = completed.has(d);
        const partial = loggedDates.has(d) && !done;
        const isToday = d === new Date().toISOString().split("T")[0];
        return (
          <div key={d} title={d}
            className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all",
              done ? "bg-emerald-500 border-emerald-400 text-white" :
              partial ? "bg-amber-400 border-amber-300 text-white" :
              isToday ? "bg-white border-teal-400 text-teal-600 ring-1 ring-teal-300" :
              "bg-slate-100 border-slate-200 text-slate-400")}>
            {done ? "✓" : partial ? "~" : isToday ? "•" : ""}
          </div>
        );
      })}
    </div>
  );
}

export default function PlannerPage() {
  const { data: plans } = useListPlans();
  const { data: todayLog, refetch: refetchTodayLog } = useGetTodayLog({ query: { retry: false, queryKey: getGetTodayLogQueryKey() } });
  const { data: convos } = useListConversations();
  const createPlan = useCreatePlan();
  const createConversation = useCreateConversation();
  const { toast } = useToast();

  // Fetch 7-day log history for progress tracking
  const { data: recentLogDates } = useQuery<{ logDate: string; isCompleted: boolean | null }[]>({
    queryKey: ["/api/logs/dates", 7],
    queryFn: async () => {
      const res = await fetch("/api/logs/dates?days=7", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  const loggedDates = new Set(recentLogDates?.map(l => l.logDate) ?? []);
  const completedDates = new Set(recentLogDates?.filter(l => l.isCompleted).map(l => l.logDate) ?? []);

  const [isAddPlanOpen, setIsAddPlanOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calRefresh, setCalRefresh] = useState(0);
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
      const isToday = date === new Date().toISOString().split("T")[0];
      const url = isToday ? "/api/logs/today" : `/api/logs/date/${date}`;
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) setSelectedLog(await res.json());
      else setSelectedLog(null);
    } catch { setSelectedLog(null); }
    setLogOpen(true);
  }, []);

  const openTodayLog = () => openLogForDate(new Date().toISOString().split("T")[0]);

  const handleLogSaved = (log: DailyLog) => {
    setSelectedLog(log);
    refetchTodayLog();
    queryClient.invalidateQueries({ queryKey: getGetTodayLogQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/logs/dates", 7] });
    setCalRefresh(n => n + 1);
  };

  const isCompleted = !!(todayLog as DailyLog | undefined)?.isCompleted;
  const hasLog = !!todayLog;

  const activePlans = plans?.filter(p => p.status === "active") ?? [];

  // Build today's reminders from active plan types
  const activeTypes = new Set(activePlans.map(p => p.type));
  const todayReminders = REMINDER_ITEMS.filter(r => r.types.some(t => activeTypes.has(t)));

  // Streak: consecutive completed days going backwards from yesterday
  const streak = (() => {
    let count = 0;
    for (let i = 1; i <= 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (completedDates.has(d.toISOString().split("T")[0])) count++;
      else break;
    }
    return count;
  })();

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">

      {/* ── Left Column ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 pb-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
              <CalendarHeart className="w-6 h-6 text-blue-600" />
              Plan Tracker
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {streak > 0 ? `🔥 ${streak}-day streak — keep going!` : "Track plans, daily logs, and progress"}
            </p>
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
                      <FormItem><FormLabel>Plan Title</FormLabel><FormControl><Input className="h-11" placeholder="e.g. Daily Vitamins" {...field} /></FormControl></FormItem>
                    )} />
                    <FormField control={planForm.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="medication">💊 Medication</SelectItem>
                            <SelectItem value="diet">🥗 Diet & Nutrition</SelectItem>
                            <SelectItem value="fitness">🏃 Fitness & Exercise</SelectItem>
                            <SelectItem value="recovery">😴 Rest & Recovery</SelectItem>
                            <SelectItem value="custom">🎯 Custom Goal</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={planForm.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Details / Notes</FormLabel><FormControl><Textarea className="resize-none min-h-[100px]" placeholder="Specific instructions, targets, dosage..." {...field} /></FormControl></FormItem>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">Today's Daily Log</span>
                      {isCompleted
                        ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-0.5 py-0"><CheckCircle2 size={9} /> Completed</Badge>
                        : <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] gap-0.5 py-0 animate-pulse"><Clock size={9} /> In Progress</Badge>
                      }
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isCompleted ? "All done — great work today!" : hasLog ? "Continue filling in your log." : "Tap to start your daily health log."}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </button>

        {/* Today's Reminders (from active plans) */}
        {todayReminders.length > 0 && !isCompleted && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <AlertCircle size={14} className="text-amber-500" />
              Today's Focus
              <span className="text-xs font-normal text-slate-400 ml-1">based on your active plans</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {todayReminders.map((r, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">{r.icon}</div>
                  <span className="text-xs font-medium text-slate-700">{r.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Calendar */}
        {showCalendar && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <CalendarDays size={14} className="text-slate-500" /> Log History
            </h2>
            <LogCalendar selectedDate={logDate} onSelectDate={d => openLogForDate(d)} refreshTrigger={calRefresh} />
            <p className="text-xs text-slate-400 mt-2 text-center">Click any past date to review or edit that day's log</p>
          </section>
        )}

        {/* Active Plans — with progress */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">Active Plans</h2>
            {recentLogDates && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> completed
                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block ml-1" /> partial
              </div>
            )}
          </div>

          {activePlans.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
              <CalendarHeart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-slate-700 font-medium">No active plans</h3>
              <p className="text-sm text-slate-500 mt-1">Create a plan to start tracking your health goals.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activePlans.map(p => {
                const config = PLAN_TYPE_CONFIG[p.type] ?? PLAN_TYPE_CONFIG.custom;
                const completedThisWeek = Array.from(completedDates).length;
                const pct = Math.round((completedThisWeek / 7) * 100);
                return (
                  <Card key={p.id} className={`shadow-sm border bg-gradient-to-br ${config.color} overflow-hidden`}>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className={`capitalize font-medium text-xs gap-1 ${config.badgeColor}`}>
                          {config.icon} {p.type}
                        </Badge>
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">active</Badge>
                      </div>
                      <CardTitle className="text-sm font-semibold leading-tight text-slate-800">{p.title}</CardTitle>
                      {p.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>}
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      {/* 7-day progress dots */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-slate-500 font-medium">This week</span>
                          <span className="text-xs font-semibold text-slate-700">{completedThisWeek}/7 days</span>
                        </div>
                        <WeekDots loggedDates={loggedDates} completed={completedDates} />
                        <div className="mt-2 w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Today's tasks for this plan */}
                      <div className="space-y-1">
                        {config.tasks.map((task, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                            <div className={cn("w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center",
                              isCompleted ? "bg-emerald-500 border-emerald-400 text-white" : "border-slate-300 bg-white")}>
                              {isCompleted && <CheckCircle2 className="w-2.5 h-2.5" />}
                            </div>
                            {task}
                          </div>
                        ))}
                      </div>

                      {/* CTA if not logged today */}
                      {!hasLog && (
                        <button onClick={openTodayLog}
                          className="w-full text-xs font-medium text-blue-600 hover:text-blue-800 bg-white/70 hover:bg-white border border-blue-200 rounded-lg px-3 py-1.5 transition-all text-center mt-1">
                          Log today's progress →
                        </button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Right Column: Assistant ───────────────────────────────────────────── */}
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
      <TodayLogModal open={logOpen} onOpenChange={setLogOpen} date={logDate} initialLog={selectedLog} onSaved={handleLogSaved} />
    </div>
  );
}

function PlannerChat({ conversationId }: { conversationId: number }) {
  const { data: messages } = useGetConversationMessages(conversationId, {
    query: { enabled: !!conversationId, queryKey: getGetConversationMessagesQueryKey(conversationId) }
  });
  return <ChatInterface conversationId={conversationId} initialMessages={messages || []} mode="planner" />;
}
