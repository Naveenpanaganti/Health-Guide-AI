import React from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { HeartPulse, LayoutDashboard, Stethoscope, CalendarHeart, BookOpen, LogOut, UserCircle } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: "Health Checkup", path: "/checkup", icon: <Stethoscope className="w-5 h-5" /> },
    { name: "Plan Tracker", path: "/planner", icon: <CalendarHeart className="w-5 h-5" /> },
    { name: "Health Education", path: "/educate", icon: <BookOpen className="w-5 h-5" /> },
  ];

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "U";
  const displayName = user?.fullName ?? user?.firstName ?? "My Account";

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

        {/* Profile card at top */}
        <Link href="/profile" className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-teal-50/50 hover:bg-teal-50 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
            <p className="text-xs text-teal-600 group-hover:text-teal-700 font-medium">View profile →</p>
          </div>
        </Link>

        <nav className="flex-1 px-4 py-4 space-y-1">
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
          <Link href="/profile" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-xs">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
          </Link>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
