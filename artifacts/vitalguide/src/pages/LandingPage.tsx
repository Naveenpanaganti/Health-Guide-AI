import { Link } from "wouter";
import { HeartPulse, ArrowRight, Stethoscope, CalendarHeart, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      <header className="absolute inset-x-0 top-0 h-16 flex items-center justify-between px-6 md:px-12 z-10">
        <div className="flex items-center gap-2 text-teal-700 font-semibold text-lg tracking-tight">
          <HeartPulse className="w-6 h-6" />
          VitalGuide
        </div>
        <nav className="flex items-center gap-4">
          <a href="/api/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Sign In
          </a>
          <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm" data-testid="button-get-started-header">
            <a href="/api/login">Get Started</a>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50 via-slate-50 to-slate-50" />
          
          <h1 className="max-w-4xl text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6">
            Your trusted <span className="text-teal-600">health companion.</span>
          </h1>
          <p className="max-w-2xl text-lg md:text-xl text-slate-600 mb-10 leading-relaxed">
            VitalGuide brings clarity to your well-being. Understand your symptoms, track personalized care plans, and build healthier habits with clinical confidence and warm guidance.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Button size="lg" asChild className="bg-teal-600 hover:bg-teal-700 text-white rounded-full px-8 shadow-md" data-testid="button-get-started-hero">
              <a href="/api/login">
                Start Your Journey <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900">Three ways to better health</h2>
              <p className="mt-4 text-slate-600 text-lg">Designed to support every step of your wellness journey.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-6">
                  <Stethoscope className="w-6 h-6 text-teal-700" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">AI Health Checkup</h3>
                <p className="text-slate-600 leading-relaxed">
                  Discuss symptoms and concerns in a calm, conversational interface to receive thoughtful preliminary guidance and know when to see a doctor.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-6">
                  <CalendarHeart className="w-6 h-6 text-teal-700" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">Plan Tracker</h3>
                <p className="text-slate-600 leading-relaxed">
                  Stay on top of your daily routines, medications, and fitness goals with structured plans and a simple, scannable daily log.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-6">
                  <BookOpen className="w-6 h-6 text-teal-700" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">Health Education</h3>
                <p className="text-slate-600 leading-relaxed">
                  Explore general medical concepts, dietary science, and wellness practices to build a deeper understanding of human health.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} VitalGuide. A personal health companion.</p>
      </footer>
    </div>
  );
}
