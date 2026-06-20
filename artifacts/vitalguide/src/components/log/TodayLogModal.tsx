import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, Sunrise, Sunset, Utensils, Candy, Plus, X, CheckCircle2, Clock, Droplets, Bot, Save, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Time Picker ────────────────────────────────────────────────────────────────
function to24(h: number, m: number, ampm: "AM" | "PM") {
  let h24 = h % 12;
  if (ampm === "PM") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function from24(value: string): { h: number; m: number; ampm: "AM" | "PM" } | null {
  if (!value) return null;
  const [hStr, mStr] = value.split(":");
  const h24 = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h24) || isNaN(m)) return null;
  const ampm: "AM" | "PM" = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h, m, ampm };
}

function formatDisplay(value: string): string {
  const parsed = from24(value);
  if (!parsed) return "";
  const { h, m, ampm } = parsed;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

const SLEEP_PRESETS = ["8:00 PM", "9:00 PM", "9:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM", "12:00 AM", "1:00 AM"];
const WAKE_PRESETS  = ["4:30 AM", "5:00 AM", "5:30 AM", "6:00 AM", "6:30 AM", "7:00 AM", "7:30 AM", "8:00 AM", "9:00 AM", "10:00 AM"];

function parsePreset(preset: string): string {
  const [time, period] = preset.split(" ");
  const [hStr, mStr] = time.split(":");
  return to24(parseInt(hStr), parseInt(mStr), period as "AM" | "PM");
}

type TimePickerProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: string[];
  error?: boolean;
  icon?: React.ReactNode;
};

function TimePicker({ label, value, onChange, presets, error, icon }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const display = formatDisplay(value);
  const parsed = from24(value);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setTextMode(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handlePreset = (preset: string) => {
    onChange(parsePreset(preset));
    setOpen(false);
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const toggleAmPm = () => {
    if (!parsed) return;
    const newAmPm: "AM" | "PM" = parsed.ampm === "AM" ? "PM" : "AM";
    onChange(to24(parsed.h, parsed.m, newAmPm));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5 block">
        {icon}{label}
      </label>

      {/* Main trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(p => !p); setTextMode(false); }}
        className={cn(
          "w-full h-10 px-3 flex items-center justify-between rounded-lg border bg-slate-50 text-sm transition-all",
          "hover:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:ring-offset-1",
          error ? "border-red-400" : "border-slate-200",
          open && "border-teal-400 ring-2 ring-teal-200"
        )}
      >
        <span className={display ? "text-slate-800 font-medium" : "text-slate-400"}>
          {display || "Select time"}
        </span>
        <div className="flex items-center gap-1.5">
          {value && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(""); }}
              className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-500 flex items-center justify-center text-slate-400 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
          <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1.5 w-72 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          {/* Native time input row */}
          <div className="px-3 pt-3 pb-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Enter time</p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={value}
                onChange={handleNativeChange}
                className="flex-1 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
              {parsed && (
                <button
                  type="button"
                  onClick={toggleAmPm}
                  className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-teal-700 hover:bg-teal-50 hover:border-teal-300 transition-colors"
                >
                  {parsed.ampm}
                </button>
              )}
            </div>
          </div>

          {/* Quick presets */}
          <div className="p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick select</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map(preset => {
                const val = parsePreset(preset);
                const active = val === value;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePreset(preset)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                      active
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50"
                    )}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ──────────────────────────────────────────────────────────────────────────────

export type DailyLog = {
  id?: number;
  logDate?: string;
  mood?: string | null;
  sleepHours?: number | null;
  sleepAt?: string | null;
  wokeAt?: string | null;
  bodyCheckMorning?: string | null;
  bodyCheckAfternoon?: string | null;
  bodyCheckEvening?: string | null;
  bodyCheckNight?: string | null;
  waterIntake?: number | null;
  foodLog?: string | null;
  foodMorning?: string | null;
  foodAfternoon?: string | null;
  foodEvening?: string | null;
  foodNight?: string | null;
  junkSugarIntake?: string | null;
  symptomsLog?: string | null;
  notes?: string | null;
  isCompleted?: boolean | null;
  customSections?: string | null;
};

type ChipProps = { label: string; selected: boolean; onClick: () => void; color?: string };
function Chip({ label, selected, onClick, color = "teal" }: ChipProps) {
  const colors: Record<string, string> = {
    teal: "border-teal-300 bg-teal-50 text-teal-800",
    amber: "border-amber-300 bg-amber-50 text-amber-800",
    blue: "border-blue-300 bg-blue-50 text-blue-800",
    slate: "border-slate-300 bg-slate-100 text-slate-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150",
        selected ? colors[color] + " ring-2 ring-offset-1 ring-current shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
      )}
    >
      {label}
    </button>
  );
}

function calcSleepHours(sleepAt: string, wokeAt: string): number | null {
  if (!sleepAt || !wokeAt) return null;
  const [sH, sM] = sleepAt.split(":").map(Number);
  const [wH, wM] = wokeAt.split(":").map(Number);
  if (isNaN(sH) || isNaN(wH)) return null;
  let sleepMins = sH * 60 + sM;
  let wokeMins = wH * 60 + wM;
  if (wokeMins <= sleepMins) wokeMins += 24 * 60;
  return Math.round((wokeMins - sleepMins) / 6) / 10;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

const MOODS = [
  { value: "great", label: "😄 Great" },
  { value: "good", label: "🙂 Good" },
  { value: "okay", label: "😐 Okay" },
  { value: "low", label: "😔 Low" },
  { value: "bad", label: "😞 Bad" },
];

type SectionLabelProps = { icon: React.ReactNode; title: React.ReactNode; subtitle?: string };
function SectionLabel({ icon, title, subtitle }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: string;
  initialLog?: DailyLog | null;
  onSaved?: (log: DailyLog) => void;
};

const BODY_OPTIONS = {
  morning: ["Tired", "Active", "Good", "Refreshed", "Groggy"],
  afternoon: ["Productive", "Stressed", "Tired", "Sleepy", "Weak", "Energetic"],
  evening: ["Relaxed", "Tired", "Stressed", "Energetic", "Content"],
  night: ["Sleepy", "Calm", "Stressed", "Wide Awake", "Restless"],
};

export default function TodayLogModal({ open, onOpenChange, date, initialLog, onSaved }: Props) {
  const today = date ?? new Date().toISOString().split("T")[0];
  const { toast } = useToast();

  const [sleepAt, setSleepAt] = useState(initialLog?.sleepAt ?? "");
  const [wokeAt, setWokeAt] = useState(initialLog?.wokeAt ?? "");
  const [bodyCheck, setBodyCheck] = useState({
    morning: initialLog?.bodyCheckMorning ?? "",
    afternoon: initialLog?.bodyCheckAfternoon ?? "",
    evening: initialLog?.bodyCheckEvening ?? "",
    night: initialLog?.bodyCheckNight ?? "",
  });
  const [food, setFood] = useState({
    morning: initialLog?.foodMorning ?? "",
    afternoon: initialLog?.foodAfternoon ?? "",
    evening: initialLog?.foodEvening ?? "",
    night: initialLog?.foodNight ?? "",
  });
  const [water, setWater] = useState(String(initialLog?.waterIntake ?? ""));
  const [mood, setMood] = useState(initialLog?.mood ?? "");
  const [showJunk, setShowJunk] = useState(!!initialLog?.junkSugarIntake);
  const [junk, setJunk] = useState(initialLog?.junkSugarIntake ?? "");
  const [notes, setNotes] = useState(initialLog?.notes ?? "");
  const [customSections, setCustomSections] = useState<{ key: string; value: string }[]>(
    (() => { try { return initialLog?.customSections ? JSON.parse(initialLog.customSections) : []; } catch { return []; } })()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [existingId, setExistingId] = useState<number | undefined>(initialLog?.id);
  const [errors, setErrors] = useState<{ mood?: string; sleep?: string; water?: string }>({});

  useEffect(() => {
    if (initialLog) {
      setSleepAt(initialLog.sleepAt ?? "");
      setWokeAt(initialLog.wokeAt ?? "");
      setBodyCheck({
        morning: initialLog.bodyCheckMorning ?? "",
        afternoon: initialLog.bodyCheckAfternoon ?? "",
        evening: initialLog.bodyCheckEvening ?? "",
        night: initialLog.bodyCheckNight ?? "",
      });
      setFood({
        morning: initialLog.foodMorning ?? "",
        afternoon: initialLog.foodAfternoon ?? "",
        evening: initialLog.foodEvening ?? "",
        night: initialLog.foodNight ?? "",
      });
      setWater(String(initialLog.waterIntake ?? ""));
      setMood(initialLog.mood ?? "");
      setShowJunk(!!initialLog.junkSugarIntake);
      setJunk(initialLog.junkSugarIntake ?? "");
      setNotes(initialLog.notes ?? "");
      setExistingId(initialLog.id);
      try { setCustomSections(initialLog.customSections ? JSON.parse(initialLog.customSections) : []); } catch { setCustomSections([]); }
    }
  }, [initialLog]);

  const sleepHours = useMemo(() => calcSleepHours(sleepAt, wokeAt), [sleepAt, wokeAt]);

  const buildPayload = useCallback((completed: boolean) => ({
    logDate: today,
    mood: mood || undefined,
    sleepAt: sleepAt || undefined,
    wokeAt: wokeAt || undefined,
    sleepHours: sleepHours ?? undefined,
    bodyCheckMorning: bodyCheck.morning || undefined,
    bodyCheckAfternoon: bodyCheck.afternoon || undefined,
    bodyCheckEvening: bodyCheck.evening || undefined,
    bodyCheckNight: bodyCheck.night || undefined,
    waterIntake: water ? Number(water) : undefined,
    foodMorning: food.morning || undefined,
    foodAfternoon: food.afternoon || undefined,
    foodEvening: food.evening || undefined,
    foodNight: food.night || undefined,
    junkSugarIntake: showJunk ? junk || undefined : undefined,
    notes: notes || undefined,
    customSections: customSections.length ? JSON.stringify(customSections) : undefined,
    isCompleted: completed,
  }), [today, mood, sleepAt, wokeAt, sleepHours, bodyCheck, water, food, showJunk, junk, notes, customSections]);

  const validate = () => {
    const newErrors: { mood?: string; sleep?: string; water?: string } = {};
    if (!mood) newErrors.mood = "Please select how you felt today.";
    if (!sleepAt || !wokeAt) newErrors.sleep = "Please enter both sleep and wake times.";
    if (!water || Number(water) < 0) newErrors.water = "Please enter your water intake.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const save = async (completed: boolean) => {
    if (completed && !validate()) {
      toast({ title: "Please fill required fields", description: "Mood, sleep times, and water intake are required to mark complete.", variant: "destructive" });
      return;
    }
    setErrors({});
    setIsSaving(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      let url: string;
      let method: string;

      if (existingId) {
        url = `/api/logs/${existingId}`;
        method = "PATCH";
      } else {
        const isToday = today === new Date().toISOString().split("T")[0];
        url = isToday ? "/api/logs/today" : "/api/logs";
        method = isToday ? "PATCH" : "POST";
      }

      const res = await fetch(url, { method, headers, credentials: "include", body: JSON.stringify(buildPayload(completed)) });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setExistingId(data.id);
      onSaved?.(data);
      toast({ title: completed ? "Log completed! ✓" : "Draft saved", description: completed ? "Great job staying consistent." : "You can come back and finish later." });
      if (completed) onOpenChange(false);
    } catch {
      toast({ title: "Error saving", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const isToday = today === new Date().toISOString().split("T")[0];
  const isPast = today < new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {isToday ? "Today's Log" : isPast ? "Past Log" : "Upcoming"}
              </DialogTitle>
              <p className="text-sm text-slate-500 mt-0.5">{formatDate(today)}</p>
            </div>
            <Badge className={cn("text-xs font-semibold mt-1", initialLog?.isCompleted ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200")}>
              {initialLog?.isCompleted ? "✓ Completed" : "In Progress"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-7">
          {/* Sleep */}
          <section>
            <SectionLabel icon={<Moon size={14} />} title={<span>Sleep <span className="text-red-500 ml-0.5">*</span></span>} subtitle="When did you sleep and wake up?" />
            <div className="grid grid-cols-2 gap-4">
              <TimePicker
                label="Slept at"
                value={sleepAt}
                onChange={v => { setSleepAt(v); setErrors(p => ({ ...p, sleep: undefined })); }}
                presets={SLEEP_PRESETS}
                error={!!errors.sleep}
                icon={<Moon size={11} className="text-indigo-400" />}
              />
              <TimePicker
                label="Woke at"
                value={wokeAt}
                onChange={v => { setWokeAt(v); setErrors(p => ({ ...p, sleep: undefined })); }}
                presets={WAKE_PRESETS}
                error={!!errors.sleep}
                icon={<Sun size={11} className="text-amber-400" />}
              />
            </div>
            {errors.sleep && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">⚠ {errors.sleep}</p>}
            {sleepHours !== null && (
              <div className="mt-2.5 flex items-center gap-2 text-sm text-teal-700 bg-teal-50 rounded-lg px-3 py-2">
                <Clock size={13} />
                <span className="font-medium">≈ {sleepHours} hours</span>
                <span className="text-teal-600 text-xs">calculated automatically</span>
              </div>
            )}
          </section>

          <div className="border-t border-slate-100" />

          {/* Mood */}
          <section>
            <SectionLabel
              icon={<span className="text-base">😊</span>}
              title={<span>Overall Mood <span className="text-red-500 ml-0.5">*</span></span>}
              subtitle="How are you feeling today overall?"
            />
            <div className="flex flex-wrap gap-2">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => { setMood(prev => prev === m.value ? "" : m.value); setErrors(p => ({ ...p, mood: undefined })); }}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium border transition-all",
                    mood === m.value
                      ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                      : errors.mood
                        ? "border-red-300 bg-red-50 text-slate-600 hover:border-red-400"
                        : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {errors.mood && <p className="mt-1.5 text-xs text-red-500">⚠ {errors.mood}</p>}
          </section>

          <div className="border-t border-slate-100" />

          {/* Body Check */}
          <section>
            <SectionLabel icon={<Sun size={14} />} title="Body Check" subtitle="How did you feel throughout the day?" />
            <div className="space-y-4">
              {(["morning", "afternoon", "evening", "night"] as const).map((period) => {
                const icons = { morning: <Sunrise size={12} />, afternoon: <Sun size={12} />, evening: <Sunset size={12} />, night: <Moon size={12} /> };
                return (
                  <div key={period}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-slate-400">{icons[period]}</span>
                      <span className="text-xs font-semibold text-slate-600 capitalize">{period}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {BODY_OPTIONS[period].map(opt => (
                        <Chip key={opt} label={opt} selected={bodyCheck[period] === opt.toLowerCase()} onClick={() => setBodyCheck(p => ({ ...p, [period]: p[period] === opt.toLowerCase() ? "" : opt.toLowerCase() }))} color={period === "morning" ? "teal" : period === "afternoon" ? "amber" : period === "evening" ? "blue" : "slate"} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="border-t border-slate-100" />

          {/* Food Consumption */}
          <section>
            <SectionLabel icon={<Utensils size={14} />} title="Food Consumption" subtitle="What did you eat today?" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["morning", "afternoon", "evening", "night"] as const).map(period => (
                <div key={period}>
                  <label className="text-xs font-medium text-slate-600 mb-1.5 block capitalize">{period === "morning" ? "🌅 Morning / Breakfast" : period === "afternoon" ? "☀️ Afternoon / Lunch" : period === "evening" ? "🌆 Evening / Dinner" : "🌙 Night / Snack"}</label>
                  <Textarea value={food[period]} onChange={e => setFood(p => ({ ...p, [period]: e.target.value }))} className="resize-none min-h-[60px] bg-slate-50 text-sm" placeholder="What did you have?" />
                </div>
              ))}
            </div>
          </section>

          <div className="border-t border-slate-100" />

          {/* Water */}
          <section>
            <SectionLabel
              icon={<Droplets size={14} />}
              title={<span>Water Intake <span className="text-red-500 ml-0.5">*</span></span>}
              subtitle="How many glasses of water?"
            />
            <div className="flex items-center gap-3">
              <Input
                type="number" min={0} max={20} value={water}
                onChange={e => { setWater(e.target.value); setErrors(p => ({ ...p, water: undefined })); }}
                className={cn("h-10 bg-slate-50 w-28", errors.water && "border-red-400 focus-visible:ring-red-300")}
                placeholder="e.g. 6"
              />
              <span className="text-sm text-slate-500">glasses</span>
              <div className="flex gap-1 ml-2">
                {[4, 6, 8, 10].map(n => (
                  <button key={n} type="button" onClick={() => { setWater(String(n)); setErrors(p => ({ ...p, water: undefined })); }} className={cn("px-2.5 py-1 rounded text-xs font-medium border transition-all", water === String(n) ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300")}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {errors.water && <p className="mt-1.5 text-xs text-red-500">⚠ {errors.water}</p>}
          </section>

          {/* Junk/Sugar */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel icon={<Candy size={14} />} title="Junk / Sugar Intake" subtitle="Optional — only if relevant" />
              <button type="button" onClick={() => setShowJunk(p => !p)} className={cn("text-xs font-medium px-3 py-1 rounded-full border transition-all", showJunk ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50 text-slate-500 border-slate-200")}>
                {showJunk ? "Hide" : "Track this"}
              </button>
            </div>
            {showJunk && (
              <Textarea value={junk} onChange={e => setJunk(e.target.value)} className="resize-none min-h-[60px] bg-slate-50 text-sm" placeholder="e.g. 1 can of soda, 2 cookies..." />
            )}
          </section>

          <div className="border-t border-slate-100" />

          {/* Custom Sections */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel icon={<Plus size={14} />} title="Custom Sections" subtitle="Add workout, office hours, etc." />
              <Button type="button" variant="outline" size="sm" onClick={() => setCustomSections(p => [...p, { key: "", value: "" }])} className="text-xs h-8 gap-1">
                <Plus size={12} /> Add section
              </Button>
            </div>
            <div className="space-y-3">
              {customSections.map((sec, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input value={sec.key} onChange={e => setCustomSections(p => p.map((s, j) => j === i ? { ...s, key: e.target.value } : s))} className="h-9 bg-slate-50 w-32 flex-shrink-0 text-sm" placeholder="Label" />
                  <Input value={sec.value} onChange={e => setCustomSections(p => p.map((s, j) => j === i ? { ...s, value: e.target.value } : s))} className="h-9 bg-slate-50 flex-1 text-sm" placeholder="e.g. 45 min, 9am-6pm..." />
                  <button type="button" onClick={() => setCustomSections(p => p.filter((_, j) => j !== i))} className="w-9 h-9 flex items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {customSections.length === 0 && (
                <p className="text-xs text-slate-400 italic">No custom sections yet. Add workout time, office hours, etc.</p>
              )}
            </div>
          </section>

          {/* Notes */}
          <section>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Additional Notes / Symptoms</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="resize-none min-h-[70px] bg-slate-50 text-sm" placeholder="Any symptoms, how you felt overall, things to remember..." />
          </section>
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-between gap-3">
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50" onClick={() => toast({ title: "AI Assistant", description: "Switch to the Planner Assistant to chat with AI and fill in your log automatically." })}>
            <Bot size={14} /> Ask AI to fill
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={isSaving} onClick={() => save(false)}>
              <Save size={14} /> {isSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button type="button" size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white" disabled={isSaving} onClick={() => save(true)}>
              <CheckCircle2 size={14} /> Mark Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
