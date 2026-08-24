import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Lock,
  Heart,
  Compass,
  Repeat,
  CheckSquare,
  Target,
  Wallet,
  FileText,
  Users,
} from 'lucide-react';

export function LandingPage() {
  const { loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const handleLaunchDemo = async () => {
    await loginAsDemo();
    navigate('/app');
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-20 py-12 sm:py-20 px-6 sm:px-12 max-w-6xl mx-auto w-full animate-in fade-in duration-200">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
          <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span>Thoughtfully crafted for calm, intentional living</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-serif font-semibold tracking-tight text-neutral-950 dark:text-[#F0EEE6] leading-[1.15]">
          Your life, unhurried and in focus.
        </h1>

        <p className="text-base sm:text-lg text-neutral-600 dark:text-[#8D9793] max-w-2xl mx-auto leading-relaxed">
          A calm, private space to organize what matters today, nurture lasting habits, and reach meaningful goals without mental noise or overwhelm.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Button
            size="lg"
            onClick={handleLaunchDemo}
            rightIcon={<ArrowRight className="h-4 w-4" />}
            className="shadow-md bg-gradient-to-r from-[#D9822B] to-[#C97F5C] hover:from-[#c27222] hover:to-[#b8704f] text-white border-0"
          >
            Start Free in 30 Seconds
          </Button>

          <Link to="/login">
            <Button size="lg" variant="outline">
              Sign In to Your Space
            </Button>
          </Link>
        </div>
      </section>

      {/* Human-Centered Pillars */}
      <section className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/80 dark:bg-[#182024]/80 p-6 space-y-3 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Compass className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-[#F0EEE6]">
            Clarity Over Chaos
          </h3>
          <p className="text-xs text-neutral-600 dark:text-[#8D9793] leading-relaxed">
            Start each morning with one clear daily intention. Break big aspirations into gentle, manageable steps.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/80 dark:bg-[#182024]/80 p-6 space-y-3 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
            <Lock className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-[#F0EEE6]">
            Bank-Grade Privacy
          </h3>
          <p className="text-xs text-neutral-600 dark:text-[#8D9793] leading-relaxed">
            Your private reflections and finances are encrypted with AES-256-GCM. We never sell your data or train public models.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white/80 dark:bg-[#182024]/80 p-6 space-y-3 shadow-xs">
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 flex items-center justify-center">
            <Heart className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-[#F0EEE6]">
            Gentle Daily Flow
          </h3>
          <p className="text-xs text-neutral-600 dark:text-[#8D9793] leading-relaxed">
            Connect tasks, habits, and evening reflection into a natural rhythm that restores peace of mind.
          </p>
        </div>
      </section>

      {/* Everyday Life Domains */}
      <section className="w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-serif font-semibold text-neutral-900 dark:text-[#F0EEE6]">
            Everything in harmony
          </h2>
          <p className="text-xs sm:text-sm text-neutral-600 dark:text-[#8D9793]">
            Explore the calm modules designed to keep your personal world balanced.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: 'Daily Tasks & Intentions',
              desc: 'Focus on what matters most today without cluttered backlog anxiety.',
              icon: <CheckSquare className="h-5 w-5 text-amber-600" />,
            },
            {
              title: 'Atomic Habits & Streaks',
              desc: 'Nurture routines that stick with flexible frequencies and streak continuity.',
              icon: <Repeat className="h-5 w-5 text-emerald-600" />,
            },
            {
              title: 'Meaningful Goals',
              desc: 'Turn annual visions into quarterly milestones with weighted progress.',
              icon: <Target className="h-5 w-5 text-indigo-600" />,
            },
            {
              title: 'Calm Finances',
              desc: 'Track monthly cashflow, envelope budgets, and savings with zero stress.',
              icon: <Wallet className="h-5 w-5 text-blue-600" />,
            },
            {
              title: 'Reflections & Balance',
              desc: 'Evening check-ins to celebrate wins, release tension, and sleep soundly.',
              icon: <Heart className="h-5 w-5 text-rose-600" />,
            },
            {
              title: 'Connected Notes',
              desc: 'Capture ideas, books, and thoughts linked seamlessly across your life.',
              icon: <FileText className="h-5 w-5 text-purple-600" />,
            },
          ].map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] bg-white/60 dark:bg-[#182024]/60 p-5 space-y-2.5"
            >
              <div className="h-9 w-9 rounded-lg bg-neutral-100 dark:bg-[#202A2E] flex items-center justify-center">
                {item.icon}
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-[#F0EEE6]">{item.title}</h4>
              <p className="text-xs text-neutral-500 dark:text-[#8D9793] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="w-full rounded-3xl bg-gradient-to-r from-[#D9822B]/15 via-[#C97F5C]/15 to-[#57ABA0]/15 border border-amber-500/30 p-8 sm:p-12 text-center space-y-6">
        <h2 className="text-2xl sm:text-3xl font-serif font-semibold text-neutral-900 dark:text-[#F0EEE6]">
          Ready to experience a calmer day?
        </h2>
        <p className="text-xs sm:text-sm text-neutral-600 dark:text-[#8D9793] max-w-xl mx-auto leading-relaxed">
          Create your private workspace today. No credit card required to get started.
        </p>
        <Button
          size="lg"
          onClick={handleLaunchDemo}
          className="shadow-md bg-[#D9822B] hover:bg-[#c27222] text-white border-0"
        >
          Get Started for Free
        </Button>
      </section>
    </div>
  );
}
