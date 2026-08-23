import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { taskService } from '../../services/task.service';
import { goalService } from '../../services/goal.service';
import { habitService, getTodayDateString } from '../../services/habit.service';
import { Button } from '../ui/Button';
import {
  Sparkles,
  ArrowRight,
  Check,
  Compass,
  Briefcase,
  Heart,
  Wallet,
  Smile,
  Users,
  BookOpen,
} from 'lucide-react';

interface PriorityOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  sampleTask: string;
  sampleGoal: string;
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    id: 'work_focus',
    label: 'Deep Work & Career',
    description: 'Advance key projects and maintain uninterrupted focus.',
    icon: <Briefcase className="h-4 w-4" />,
    sampleTask: 'Complete primary project milestone for the week',
    sampleGoal: 'Achieve quarterly professional milestone',
  },
  {
    id: 'health_vitality',
    label: 'Health & Vitality',
    description: 'Consistent sleep, mindful movement, and physical energy.',
    icon: <Heart className="h-4 w-4" />,
    sampleTask: '30-minute afternoon walk or movement session',
    sampleGoal: 'Establish a consistent daily movement rhythm',
  },
  {
    id: 'money_clarity',
    label: 'Financial Clarity',
    description: 'Track cash flow, build savings, and spend intentionally.',
    icon: <Wallet className="h-4 w-4" />,
    sampleTask: 'Review monthly subscriptions and categorize expenses',
    sampleGoal: 'Maintain positive monthly cash flow and savings reserve',
  },
  {
    id: 'peace_of_mind',
    label: 'Peace of Mind',
    description: 'Reduce overwhelm, reflect regularly, and live unhurried.',
    icon: <Smile className="h-4 w-4" />,
    sampleTask: '10-minute quiet evening reflection and disconnect',
    sampleGoal: 'Cultivate a calm, restorative daily evening routine',
  },
  {
    id: 'relationships',
    label: 'Meaningful Connections',
    description: 'Nurture deep friendships, family ties, and trusted mentors.',
    icon: <Users className="h-4 w-4" />,
    sampleTask: 'Reach out to a close friend or family member',
    sampleGoal: 'Keep weekly meaningful contact with core relationships',
  },
  {
    id: 'learning_growth',
    label: 'Learning & Mastery',
    description: 'Read deliberately, capture insights, and hone craft.',
    icon: <BookOpen className="h-4 w-4" />,
    sampleTask: 'Read 20 pages and capture key insights in Notes',
    sampleGoal: 'Complete one in-depth learning track or book this month',
  },
];

export interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const { user, updateProfile } = useAuth();
  const { success } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>(['work_focus', 'peace_of_mind']);
  const [dailyIntention, setDailyIntention] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const togglePriority = (id: string) => {
    setSelectedPriorities((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= 3) {
        // limit to 3 to keep focus sharp
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const handleFinishOnboarding = async () => {
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      // Find selected priority objects
      const activePriors = PRIORITY_OPTIONS.filter((p) => selectedPriorities.includes(p.id));
      const primaryFocus = activePriors[0]?.label || 'Deep Work & Peace of Mind';

      // Save user primary life focus in profile
      await updateProfile({
        primaryLifeFocus: primaryFocus,
      });

      // If user typed a custom intention or we use the first priority's task
      const taskTitle = dailyIntention.trim() || activePriors[0]?.sampleTask || 'Plan my top focus for today';
      await taskService.createTask(user.id, {
        title: taskTitle,
        description: `Generated during onboarding based on focus: ${primaryFocus}`,
        priority: 'urgent',
        dueDate: getTodayDateString(),
        tags: ['intention', 'today'],
      });

      // Seed a starter goal if none exists
      if (activePriors[0]?.sampleGoal) {
        await goalService.createGoal(user.id, {
          title: activePriors[0].sampleGoal,
          description: `Strategic horizon for ${activePriors[0].label}`,
          category: 'career_craft',
          timeframe: 'quarterly',
          targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          milestones: [
            { title: 'Define key success metrics', weight: 30 },
            { title: 'Consistent weekly execution', weight: 40 },
            { title: 'Final milestone review', weight: 30 },
          ],
        });
      }

      // Mark onboarding as complete in localStorage
      localStorage.setItem(`origin_onboarding_completed_${user.id}`, 'true');
      success('Welcome to ORIGIN', 'Your personal space is prepared. Focus on what matters today.');
      onComplete();
    } catch {
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#182024] border border-neutral-200/80 dark:border-[rgba(240,238,230,0.1)] shadow-2xl p-6 sm:p-8 flex flex-col justify-between max-h-[90vh] overflow-y-auto">
        {/* Step Indicator Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="h-7 w-7 rounded-lg p-[1.5px] flex items-center justify-center"
                style={{ background: 'conic-gradient(from 200deg, #E3A857, #C97F5C, #57ABA0, #E3A857)' }}
              >
                <div className="h-full w-full rounded-[6.5px] bg-[#FAF8F5] dark:bg-[#10161A] flex items-center justify-center font-bold text-xs font-mono text-[#D9822B] dark:text-[#E3A857]">
                  O
                </div>
              </div>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#707A75] dark:text-[#8D9793]">
                ORIGIN • Personal Life OS
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
              <span className={step === 1 ? 'text-[#D9822B] dark:text-[#E3A857] font-bold' : ''}>1</span>
              <span>/</span>
              <span className={step === 2 ? 'text-[#D9822B] dark:text-[#E3A857] font-bold' : ''}>2</span>
              <span>/</span>
              <span className={step === 3 ? 'text-[#D9822B] dark:text-[#E3A857] font-bold' : ''}>3</span>
            </div>
          </div>

          {/* STEP 1: Choose 1-3 Priorities */}
          {step === 1 && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-neutral-900 dark:text-[#F0EEE6] tracking-tight">
                  What matters most to you right now?
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-[#8D9793] leading-relaxed">
                  Select up to 3 core dimensions. ORIGIN will organize your daily focus and suggestions around them.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {PRIORITY_OPTIONS.map((opt) => {
                  const isSelected = selectedPriorities.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => togglePriority(opt.id)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#D9822B] dark:border-[#E3A857] bg-[#E3A857]/10 text-neutral-900 dark:text-[#F0EEE6] shadow-xs'
                          : 'border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] bg-neutral-50/50 dark:bg-[#202A2E]/40 hover:border-neutral-300 dark:hover:border-neutral-700 text-neutral-700 dark:text-[#8D9793]'
                      }`}
                    >
                      <div
                        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-[#E3A857] text-[#10161A]'
                            : 'bg-neutral-200/70 dark:bg-[#202A2E] text-neutral-600 dark:text-[#8D9793]'
                        }`}
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : opt.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-neutral-900 dark:text-[#F0EEE6]">
                          {opt.label}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-[#8D9793] leading-snug mt-0.5">
                          {opt.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: One Daily Intention */}
          {step === 2 && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-neutral-900 dark:text-[#F0EEE6] tracking-tight">
                  What is one thing you want to accomplish today?
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-[#8D9793] leading-relaxed">
                  Keep it simple and actionable. This will become your primary focus when you land on Home.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Finish the design draft, or 30-min walk in the park"
                  value={dailyIntention}
                  onChange={(e) => setDailyIntention(e.target.value)}
                  className="w-full px-4 py-3.5 text-sm rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.12)] bg-neutral-50 dark:bg-[#202A2E]/50 focus:outline-none focus:ring-2 focus:ring-[#D9822B] dark:focus:ring-[#E3A857] text-neutral-900 dark:text-[#F0EEE6]"
                />

                <div className="p-4 rounded-2xl bg-[#57ABA0]/10 border border-[#57ABA0]/20 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#57ABA0]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>The ORIGIN Philosophy</span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-[#8D9793] leading-relaxed">
                    Complexity belongs in the background. Your interface stays clear, focused, and calm so you can do your best work without friction.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Ready to Begin */}
          {step === 3 && (
            <div className="space-y-4 pt-2 text-center py-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-[#93AC78]/15 text-[#6B8550] dark:text-[#93AC78] flex items-center justify-center">
                <Check className="h-7 w-7 stroke-[2.5]" />
              </div>

              <div className="space-y-1.5">
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-neutral-900 dark:text-[#F0EEE6] tracking-tight">
                  Your workspace is ready.
                </h2>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-[#8D9793] max-w-md mx-auto leading-relaxed">
                  We have tuned ORIGIN to your priorities. Every time you open the app, you will immediately know what matters today.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-[#202A2E]/40 border border-neutral-200/60 dark:border-[rgba(240,238,230,0.08)] max-w-md mx-auto text-left text-xs space-y-1.5">
                <div className="font-semibold text-neutral-900 dark:text-[#F0EEE6]">
                  Daily Routine Preview:
                </div>
                <ul className="text-neutral-600 dark:text-[#8D9793] space-y-1">
                  <li>• <strong>Morning:</strong> Arrive, review today&apos;s primary focus, and act.</li>
                  <li>• <strong>Afternoon:</strong> Check off actions and log quick updates.</li>
                  <li>• <strong>Evening:</strong> 1-minute reflection and quiet progress review.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="pt-6 mt-6 border-t border-neutral-100 dark:border-[rgba(240,238,230,0.08)] flex items-center justify-between">
          {step > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => (s - 1) as 1 | 2)}
              className="text-xs text-neutral-500 dark:text-[#8D9793]"
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button
              size="md"
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              rightIcon={<ArrowRight className="h-4 w-4" />}
              className="rounded-full bg-neutral-900 text-white dark:bg-[#F0EEE6] dark:text-[#10161A] hover:bg-neutral-800 text-xs px-5 shadow-xs"
            >
              Continue
            </Button>
          ) : (
            <Button
              size="md"
              isLoading={isSubmitting}
              onClick={handleFinishOnboarding}
              rightIcon={<ArrowRight className="h-4 w-4" />}
              className="rounded-full bg-[#E3A857] text-[#10161A] hover:bg-[#D9822B] font-semibold text-xs px-6 shadow-md"
            >
              Enter ORIGIN
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
