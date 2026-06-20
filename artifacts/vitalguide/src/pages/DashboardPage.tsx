import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetProfile, useListPlans, useGetTodayLog, getGetProfileQueryKey, getListPlansQueryKey, getGetTodayLogQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Stethoscope, CalendarHeart, BookOpen, Activity, CheckCircle } from "lucide-react";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useGetProfile({
    query: { retry: false, queryKey: getGetProfileQueryKey() }
  });
  const { data: plans, isLoading: isLoadingPlans } = useListPlans({
    query: { enabled: !!profile, queryKey: getListPlansQueryKey() }
  });
  const { data: todayLog, isLoading: isLoadingLog } = useGetTodayLog({
    query: { enabled: !!profile, retry: false, queryKey: getGetTodayLogQueryKey() }
  });

  useEffect(() => {
    // If profile error is 404/not found, redirect to onboarding
    if (profileError) {
      setLocation("/onboarding");
    }
  }, [profileError, setLocation]);

  if (isLoadingProfile || isLoadingPlans || isLoadingLog) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const activePlansCount = plans?.filter(p => p.status === "active").length || 0;
  const hasLoggedToday = !!todayLog;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome, {profile.name}</h1>
        <p className="text-slate-600">Here is your health summary for today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-teal-100 bg-teal-50/50 shadow-sm transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-teal-800 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Profile Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900 tracking-tight">Complete</div>
            <p className="text-xs text-slate-600 mt-2 font-medium">Your health profile is up to date.</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200 transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <CalendarHeart className="w-4 h-4" /> Active Plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900 tracking-tight">{activePlansCount}</div>
            <p className="text-xs text-slate-600 mt-2 font-medium">Health plans currently tracking.</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Today's Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              {hasLoggedToday ? "Completed" : "Pending"}
              {hasLoggedToday && <CheckCircle className="w-6 h-6 text-teal-600" />}
            </div>
            <p className="text-xs text-slate-600 mt-2 font-medium">
              {hasLoggedToday ? "You have logged your daily check-in." : "Don't forget to log your daily health."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="pt-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-6 tracking-tight">Explore VitalGuide</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="group cursor-pointer border-slate-200 hover:border-teal-200 hover:shadow-md transition-all duration-300"
            onClick={() => setLocation("/checkup")}
          >
            <CardHeader>
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-100 transition-colors">
                <Stethoscope className="w-6 h-6 text-teal-700" />
              </div>
              <CardTitle className="text-lg">AI Health Checkup</CardTitle>
              <CardDescription className="text-sm leading-relaxed mt-2 text-slate-600">
                Discuss symptoms and get preliminary guidance in a calm, confident environment.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="group cursor-pointer border-slate-200 hover:border-blue-200 hover:shadow-md transition-all duration-300"
            onClick={() => setLocation("/planner")}
          >
            <CardHeader>
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <CalendarHeart className="w-6 h-6 text-blue-700" />
              </div>
              <CardTitle className="text-lg">Plan Tracker</CardTitle>
              <CardDescription className="text-sm leading-relaxed mt-2 text-slate-600">
                Manage daily routines, medications, fitness goals, and log your daily progress.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="group cursor-pointer border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all duration-300"
            onClick={() => setLocation("/educate")}
          >
            <CardHeader>
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                <BookOpen className="w-6 h-6 text-indigo-700" />
              </div>
              <CardTitle className="text-lg">Health Education</CardTitle>
              <CardDescription className="text-sm leading-relaxed mt-2 text-slate-600">
                Learn about medical concepts, diets, fitness science, and wellness practices.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
