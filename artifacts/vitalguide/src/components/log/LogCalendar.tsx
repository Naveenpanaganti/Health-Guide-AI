import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LogDate = { logDate: string; isCompleted: boolean | null };

type Props = {
  onSelectDate: (date: string) => void;
  selectedDate?: string;
  refreshTrigger?: number;
};

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function LogCalendar({ onSelectDate, selectedDate, refreshTrigger }: Props) {
  const { getToken } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const [viewDate, setViewDate] = useState(new Date());
  const [logDates, setLogDates] = useState<LogDate[]>([]);

  const fetchDates = async () => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/logs/dates?days=90", { headers });
      if (res.ok) setLogDates(await res.json());
    } catch { /* silent */ }
  };

  useEffect(() => { fetchDates(); }, [refreshTrigger]);

  const logMap = new Map(logDates.map(l => [l.logDate, l.isCompleted]));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth();

  const getDateStyle = (dateStr: string) => {
    const isToday = dateStr === today;
    const isPast = dateStr < today;
    const isFuture = dateStr > today;
    const isSelected = dateStr === selectedDate;
    const hasLog = logMap.has(dateStr);
    const isCompleted = logMap.get(dateStr) === true;

    if (isSelected) return "bg-teal-600 text-white font-bold ring-2 ring-teal-300";
    if (isToday) return "bg-teal-500 text-white font-bold shadow-sm";
    if (isFuture) return "text-slate-300 cursor-not-allowed";
    if (isPast && isCompleted) return "bg-emerald-100 text-emerald-800 font-medium hover:bg-emerald-200 cursor-pointer";
    if (isPast && hasLog) return "bg-amber-100 text-amber-800 font-medium hover:bg-amber-200 cursor-pointer";
    if (isPast) return "text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer";
    return "text-slate-600 hover:bg-slate-100";
  };

  const cells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return d.toISOString().split("T")[0];
    }),
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-teal-600" />
          <span className="text-sm font-semibold text-slate-800">{MONTHS[month]} {year}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            <ChevronLeft size={14} />
          </Button>
          <Button variant="ghost" className="h-7 px-2 text-xs text-teal-600 hover:bg-teal-50" onClick={() => setViewDate(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} disabled={year === nowYear && month >= nowMonth}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 px-3 pt-2">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 px-3 pb-3 gap-y-1">
        {cells.map((dateStr, i) => (
          <div key={i} className="flex items-center justify-center py-0.5">
            {dateStr ? (
              <button
                onClick={() => dateStr <= today && onSelectDate(dateStr)}
                disabled={dateStr > today}
                className={cn("w-8 h-8 rounded-full text-xs flex items-center justify-center transition-all duration-100", getDateStyle(dateStr))}
              >
                {new Date(dateStr + "T00:00:00").getDate()}
              </button>
            ) : <div className="w-8 h-8" />}
          </div>
        ))}
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-50 pt-2">
        {[
          { color: "bg-teal-500", label: "Today" },
          { color: "bg-emerald-200", label: "Completed" },
          { color: "bg-amber-200", label: "In Progress" },
          { color: "bg-rose-100", label: "Missed" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", color)} />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
