import React from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { HeartPulse, LayoutDashboard, Stethoscope, CalendarHeart, BookOpen, LogOut, UserCircle } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: "Health Checkup", path: "/checkup", icon: <Stethoscope className="w-5 h-5" /> },
    { name: "Plan Tracker", path: "/planner", icon: <CalendarHeart className="w-5 h-5" /> },
    { name: "Health Education", path: "/educate", icon: <BookOpen className="w-5 h-5" /> },
    { name: "My Profile", path: "/profile", icon: <UserCircle className="w-5 h-5" /> },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <Link href="/dashboard" className="flex items-center gap-2 text-teal-700 font-semibold text-lg">
            <HeartPulse className="w-6 h-6" />
            VitalGuide
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.path);
            return (
              <Link 
                key={item.path} 
                href={item.path} 
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                  isActive 
                    ? "bg-teal-50 text-teal-700" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button 
            type="button"
            onClick={() => signOut({ redirectUrl: "/" })}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        {/* Mobile Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2 text-teal-700 font-semibold">
            <HeartPulse className="w-5 h-5" />
            VitalGuide
          </Link>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
