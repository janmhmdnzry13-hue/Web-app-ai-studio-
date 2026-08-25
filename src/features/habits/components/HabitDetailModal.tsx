import React, { useState } from 'react';
import { Dialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Habit, HabitLog } from '../../../types/habit.types';
import {
  Flame,
  Trophy,
  Check,
  Clock,
  Sparkles,
  Edit2,
  Trash2,
  Plus,
  Minus,
  Calendar,
  Heart,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { getLocalDateString } from '../../../lib/dateUtils';

interface HabitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit: Habit | null;
  logs: readonly HabitLog[];
  onToggleToday: (habitId: string) => void;
  onUpdateTodayValue: (habitId: string, value: number) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string) => void;
}

export function HabitDetailModal({
  isOpen,
  onClose,
  habit,
  logs,
  onToggleToday,
  onUpdateTodayValue,
  onEdit,
  onDelete,
}: HabitDetailModalProps) {
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!habit) return null;

  const todayStr = getLocalDateString(new Date());
  const todayLog = logs.find((l) => l.habitId === habit.id && l.date === todayStr);
  const isCompletedToday = todayLog ? todayLog.targetMet : false;
  const currentValue = todayLog ? todayLog.value : 0;
  const targetUnits = habit.targetUnits || 1;
  const isNumeric = targetUnits > 1;

  // Streak data
  const currentStreak = habit.streak?.currentStreak || 0;
  const longestStreak = habit.streak?.longestStreak || 0;
  const totalCompletions = habit.streak?.totalCompletions || logs.filter((l) => l.habitId === habit.id && l.targetMet).length;

  // 14-day mini calendar history
  const historyDays = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dStr = getLocalDateString(d);
    const log = logs.find((l) => l.habitId === habit.id && l.date === dStr);
    const isDone = log ? log.targetMet : false;
    const isToday = dStr === todayStr;
    return {
      dateStr: dStr,
      dayNum: d.getDate(),
      dayShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()],
      isDone,
      isToday,
    };
  });

  const handleAskAI = (promptType: 'easier' | 'struggle' | 'twominute') => {
    setIsAiLoading(true);
    setAiAdvice(null);
    setTimeout(() => {
      setIsAiLoading(false);
      if (promptType === 'easier') {
        setAiAdvice(
          `💡 **Friction Reduction for "${habit.name}"**:\nAnchor this habit immediately following an established ritual (e.g. right after morning water). Lower the threshold to just ${
            isNumeric ? Math.ceil(targetUnits / 3) : '1 minute'
          } ${habit.unitLabel} so starting feels effortless.`
        );
      } else if (promptType === 'struggle') {
        setAiAdvice(
          `🌱 **Gentle Reset Analysis**:\nMissing days is a natural part of forming lasting routines. If you hit resistance, ask: Is the cue clear? Place your environment in your favor (e.g. keep water bottle at desk, book on pillow). Yesterday is gone; today is a clean start.`
        );
      } else {
        setAiAdvice(
          `⚡ **2-Minute Rule Version**:\nScale "${habit.name}" down to an action that takes under two minutes: just open the book, put on your walking shoes, or fill one single glass of water. Master the art of showing up first.`
        );
      }
    }, 400);
  };

  const handleIncrement = () => {
    const step = targetUnits >= 500 ? 250 : targetUnits >= 20 ? 5 : 1;
    onUpdateTodayValue(habit.id, Math.min(targetUnits * 2, currentValue + step));
  };

  const handleDecrement = () => {
    const step = targetUnits >= 500 ? 250 : targetUnits >= 20 ? 5 : 1;
    onUpdateTodayValue(habit.id, Math.max(0, currentValue - step));
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={habit.name}
      description={`${habit.category} • ${habit.frequency.replace('_', ' ')} • ${habit.timeOfDay}`}
    >
      <div className="space-y-6 py-2">
        {/* Habit Why Banner if defined */}
        {habit.why && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <Heart className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Your Personal Why</span>
            </div>
            <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed italic">
              &ldquo;{habit.why}&rdquo;
            </p>
          </div>
        )}

        {/* Today's Action & Progress Box */}
        <div className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white dark:bg-[#182024] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-[#8D9793]">
              Today&apos;s Status
            </span>
            <span
              className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                isCompletedToday
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold'
                  : 'bg-neutral-100 dark:bg-[#202A2E] text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {isCompletedToday ? 'Completed ✓' : 'Incomplete'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <p className="text-2xl font-serif font-bold text-neutral-900 dark:text-[#F0EEE6]">
                {currentValue}{' '}
                <span className="text-sm font-sans font-normal text-neutral-400">
                  / {targetUnits} {habit.unitLabel}
                </span>
              </p>
              <p className="text-xs text-neutral-500 dark:text-[#8D9793] mt-0.5">
                Target: {targetUnits} {habit.unitLabel} per {habit.frequency}
              </p>
            </div>

            {isNumeric ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={currentValue <= 0}
                  className="h-9 w-9 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#202A2E] flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleIncrement}
                  className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 cursor-pointer shadow-2xs"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => onToggleToday(habit.id)}
                className={
                  isCompletedToday
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-0'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 border-0'
                }
              >
                {isCompletedToday ? 'Mark Incomplete' : 'Mark Complete'}
              </Button>
            )}
          </div>
        </div>

        {/* Streaks & Records */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-3 rounded-2xl border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] bg-white/60 dark:bg-[#182024]/60">
            <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
              <Flame className="h-4 w-4 fill-amber-500" />
            </div>
            <p className="text-lg font-serif font-bold text-neutral-900 dark:text-[#F0EEE6]">
              {currentStreak}d
            </p>
            <p className="text-[10px] text-neutral-500 dark:text-[#8D9793]">Current Streak</p>
          </div>

          <div className="p-3 rounded-2xl border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] bg-white/60 dark:bg-[#182024]/60">
            <div className="flex items-center justify-center gap-1 text-indigo-500 mb-1">
              <Trophy className="h-4 w-4" />
            </div>
            <p className="text-lg font-serif font-bold text-neutral-900 dark:text-[#F0EEE6]">
              {longestStreak}d
            </p>
            <p className="text-[10px] text-neutral-500 dark:text-[#8D9793]">Personal Best</p>
          </div>

          <div className="p-3 rounded-2xl border border-neutral-200/70 dark:border-[rgba(240,238,230,0.08)] bg-white/60 dark:bg-[#182024]/60">
            <div className="flex items-center justify-center gap-1 text-emerald-500 mb-1">
              <TrendingUp className="h-4 w-4" />
            </div>
            <p className="text-lg font-serif font-bold text-neutral-900 dark:text-[#F0EEE6]">
              {totalCompletions}
            </p>
            <p className="text-[10px] text-neutral-500 dark:text-[#8D9793]">Total Check-ins</p>
          </div>
        </div>

        {/* 14-Day Consistency Grid */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-neutral-700 dark:text-[#F0EEE6] flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            <span>Recent 14-Day Continuity</span>
          </span>

          <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5">
            {historyDays.map((d) => (
              <div
                key={d.dateStr}
                className="flex flex-col items-center gap-1"
                title={`${d.dateStr}: ${d.isDone ? 'Completed' : 'Missed / Rest'}`}
              >
                <span className="text-[9px] text-neutral-400">{d.dayShort}</span>
                <div
                  className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-mono transition-all ${
                    d.isDone
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-neutral-950 font-bold shadow-2xs'
                      : d.isToday
                      ? 'border border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 font-bold'
                      : 'bg-neutral-100 dark:bg-[#202A2E] text-neutral-400'
                  }`}
                >
                  {d.isDone ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : d.dayNum}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contextual AI Habit Assistant */}
        <div className="rounded-2xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-neutral-50/70 dark:bg-[#10161A]/50 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-[#F0EEE6]">
            <Sparkles className="h-4 w-4 text-[#D9822B] dark:text-[#E3A857]" />
            <span>Habit Architecture Assistant</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleAskAI('easier')}
              className="text-xs px-2.5 py-1 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#182024] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              Make this habit easier
            </button>
            <button
              type="button"
              onClick={() => handleAskAI('twominute')}
              className="text-xs px-2.5 py-1 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#182024] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              2-Minute version
            </button>
            <button
              type="button"
              onClick={() => handleAskAI('struggle')}
              className="text-xs px-2.5 py-1 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#182024] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              Overcoming resistance
            </button>
          </div>

          {isAiLoading && (
            <p className="text-xs text-neutral-400 italic">Formulating behavioral advice...</p>
          )}

          {aiAdvice && (
            <div className="p-3 rounded-xl bg-white dark:bg-[#182024] border border-neutral-200/60 dark:border-neutral-800 text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-line animate-in fade-in duration-150">
              {aiAdvice}
            </div>
          )}
        </div>

        {/* Footer Actions: Edit & Delete */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
            onClick={() => onDelete(habit.id)}
            className="text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/40"
          >
            Delete Habit
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Edit2 className="h-3.5 w-3.5" />}
              onClick={() => {
                onClose();
                onEdit(habit);
              }}
            >
              Edit Habit
            </Button>
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
