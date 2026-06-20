import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useGetProfile, useListPlans, useGetTodayLog, getGetProfileQueryKey, getListPlansQueryKey, getGetTodayLogQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, CalendarHeart, BookOpen, Activity, CheckCircle2, Clock, ChevronRight, Droplets, Moon, Utensils } from "lucide-react";
import TodayLogModal, { type DailyLog } from "@/components/log/TodayLogModal";
import { queryClient } from "@/lib/queryClient";

function StatusPill({ completed }: { completed: boolean }) {
  return completed ? (
    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 font-semibold">
      <CheckCircle2 size={11} /> Completed
    </Badge>
  ) : (
    <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1 font-semibold animate-pulse">
      <Clock size={11} /> In Progress
    </Badge>
  );
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const [logOpen, setLogOpen] = useState(false);
  const [fullLog, setFullLog] = useState<DailyLog | null>(null);

  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useGetProfile({
    query: { retry: false, queryKey: getGetProfileQueryKey() }
  });
  const { data: plans, isLoading: isLoadingPlans } = useListPlans({
    query: { enabled: !!profile, queryKey: getListPlansQueryKey() }
  });
  const { data: todayLog, isLoading: isLoadingLog, refetch: refetchLog } = useGetTodayLog({
    query: { enabled: !!profile, retry: false, queryKey: getGetTodayLogQueryKey() }
  });

  useEffect(() => {
    if (profileError) setLocation("/onboarding");
  }, [profileError, setLocation]);

  const openLog = async () => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/logs/today", { headers });
      if (res.ok) setFullLog(await res.json());
      else setFullLog(null);
    } catch { setFullLog(null); }
    setLogOpen(true);
  };

  const handleLogSaved = (log: DailyLog) => {
    setFullLog(log);
    refetchLog();
    queryClient.invalidateQueries({ queryKey: getGetTodayLogQueryKey() });
  };

  if (isLoadingProfile || isLoadingPlans || isLoadingLog) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const activePlansCount = plans?.filter(p => p.status === "active").length || 0;
  const isCompleted = !!(todayLog as DailyLog | undefined)?.isCompleted;
  const hasLog = !!todayLog;

  const quickStats = [
    { icon: <Moon size={13} />, label: "Sleep", value: (todayLog as DailyLog | undefined)?.sleepHours ? `${(todayLog as DailyLog | undefined)!.sleepHours}h` : "—" },
    { icon: <Droplets size={13} />, label: "Water", value: (todayLog as DailyLog | undefined)?.waterIntake ? `${(todayLog as DailyLog | undefined)!.waterIntake} gl` : "—" },
    { icon: <Utensils size={13} />, label: "Meals", value: [(todayLog as DailyLog | undefined)?.foodMorning, (todayLog as DailyLog | undefined)?.foodAfternoon, (todayLog as DailyLog | undefined)?.foodEvening, (todayLog as DailyLog | undefined)?.foodNight].filter(Boolean).length ? `${[(todayLog as DailyLog | undefined)?.foodMorning, (todayLog as DailyLog | undefined)?.foodAfternoon, (todayLog as DailyLog | undefined)?.foodEvening, (todayLog as DailyLog | undefined)?.foodNight].filter(Boolean).length} / 4` : "—" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back, {profile.name}</h1>
        <p className="text-slate-500 text-sm">Here's your health overview for today.</p>
      </div>

      {/* TODAY'S LOG — Hero card, always first and most prominent */}
      <button
        onClick={openLog}
        className="w-full text-left group"
        aria-label="Open Today's Log"
      >
        <Card className={`border-2 transition-all duration-200 shadow-sm group-hover:shadow-md ${isCompleted ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50" : "border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 group-hover:border-teal-300"}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${isCompleted ? "bg-emerald-100" : "bg-teal-100 group-hover:bg-teal-200 transition-colors"}`}>
                  {isCompleted
                    ? <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    : <Activity className="w-7 h-7 text-teal-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-lg font-bold text-slate-900">Today's Log</span>
                    <StatusPill completed={isCompleted} />
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    {isCompleted
                      ? "Great job — your daily health log is complete."
                      : hasLog
                        ? "You've started your log. Tap to continue filling it in."
                        : "Track your sleep, meals, mood and body check for today."}
                  </p>
                  {hasLog && (
                    <div className="flex items-center gap-4">
                      {quickStats.map(s => (
                        <div key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="text-slate-400">{s.icon}</span>
                          <span className="font-medium">{s.label}:</span>
                          <span className={s.value === "—" ? "text-slate-400" : "text-slate-700 font-semibold"}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition-colors mt-1 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </button>

      {/* Quick stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
              <Activity className="w-3.5 h-3.5" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="text-2xl font-bold text-slate-900">Complete</div>
            <p className="text-xs text-slate-500 mt-1">Health profile is up to date.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
              <CalendarHeart className="w-3.5 h-3.5" /> Active Plans
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="text-2xl font-bold text-slate-900">{activePlansCount}</div>
            <p className="text-xs text-slate-500 mt-1">Health plans currently tracking.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm transition-all hover:shadow-md cursor-pointer group" onClick={() => setLocation("/planner")}>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
              <CalendarHeart className="w-3.5 h-3.5" /> Plan Tracker
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="text-2xl font-bold text-slate-900 group-hover:text-blue-700 transition-colors">Open →</div>
            <p className="text-xs text-slate-500 mt-1">View calendar & past logs.</p>
          </CardContent>
        </Card>
      </div>

      {/* Explore section */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-4 tracking-tight">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="group cursor-pointer border-slate-200 hover:border-teal-200 hover:shadow-md transition-all duration-200" onClick={() => setLocation("/checkup")}>
            <CardHeader>
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-teal-100 transition-colors">
                <Stethoscope className="w-5 h-5 text-teal-700" />
              </div>
              <CardTitle className="text-base">AI Health Checkup</CardTitle>
              <CardDescription className="text-xs leading-relaxed mt-1 text-slate-500">
                Discuss symptoms and get preliminary guidance.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="group cursor-pointer border-slate-200 hover:border-blue-200 hover:shadow-md transition-all duration-200" onClick={() => setLocation("/planner")}>
            <CardHeader>
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                <CalendarHeart className="w-5 h-5 text-blue-700" />
              </div>
              <CardTitle className="text-base">Plan Tracker</CardTitle>
              <CardDescription className="text-xs leading-relaxed mt-1 text-slate-500">
                Manage routines, medications, and daily logs.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="group cursor-pointer border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all duration-200" onClick={() => setLocation("/educate")}>
            <CardHeader>
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
                <BookOpen className="w-5 h-5 text-indigo-700" />
              </div>
              <CardTitle className="text-base">Health Education</CardTitle>
              <CardDescription className="text-xs leading-relaxed mt-1 text-slate-500">
                Learn about nutrition, fitness, and wellness science.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      <TodayLogModal
        open={logOpen}
        onOpenChange={setLogOpen}
        initialLog={fullLog}
        onSaved={handleLogSaved}
      />
    </div>
  );
}
