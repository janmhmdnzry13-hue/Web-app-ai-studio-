import React, { useState, useEffect } from 'react';
import { Dialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import {
  Habit,
  HabitFrequency,
  HabitTimeOfDay,
  CreateHabitDTO,
} from '../../../types/habit.types';
import { Sparkles, Clock, Target, Repeat, Heart } from 'lucide-react';

interface CreateHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habitData: CreateHabitDTO) => Promise<boolean | void>;
  editingHabit?: Habit | null;
  initialTemplate?: Partial<CreateHabitDTO> | null;
}

const EMOJI_OPTIONS = ['💧', '🏃', '📖', '🧘', '🚫', '✍️', '🍏', '😴', '🏋️', '🎨', '🍵', '💡', '🌱', '🚴', '🎯', '📚'];
const WEEKDAYS = [
  { label: 'S', name: 'Sun', idx: 0 },
  { label: 'M', name: 'Mon', idx: 1 },
  { label: 'T', name: 'Tue', idx: 2 },
  { label: 'W', name: 'Wed', idx: 3 },
  { label: 'T', name: 'Thu', idx: 4 },
  { label: 'F', name: 'Fri', idx: 5 },
  { label: 'S', name: 'Sat', idx: 6 },
];

export function CreateHabitModal({
  isOpen,
  onClose,
  onSave,
  editingHabit,
  initialTemplate,
}: CreateHabitModalProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🌱');
  const [category, setCategory] = useState('Health & Energy');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [timeOfDay, setTimeOfDay] = useState<HabitTimeOfDay>('morning');
  const [targetType, setTargetType] = useState<'binary' | 'duration' | 'quantity' | 'count'>('binary');
  const [targetUnits, setTargetUnits] = useState('1');
  const [unitLabel, setUnitLabel] = useState('session');
  const [why, setWhy] = useState('');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (editingHabit) {
      setName(editingHabit.name || '');
      setIcon(editingHabit.icon || '🌱');
      setCategory(editingHabit.category || 'Health & Energy');
      setFrequency(editingHabit.frequency || 'daily');
      setTimeOfDay(editingHabit.timeOfDay || 'morning');
      setTargetUnits(String(editingHabit.targetUnits || 1));
      setUnitLabel(editingHabit.unitLabel || 'session');
      setWhy(editingHabit.why || '');
      setCustomDays(
        editingHabit.customDaysOfWeek && editingHabit.customDaysOfWeek.length > 0
          ? [...editingHabit.customDaysOfWeek]
          : [1, 2, 3, 4, 5]
      );

      const label = (editingHabit.unitLabel || '').toLowerCase();
      if (label === 'mins' || label === 'hours' || label === 'minutes' || label === 'hrs') {
        setTargetType('duration');
      } else if (['ml', 'l', 'glasses', 'oz', 'liters', 'cups'].includes(label)) {
        setTargetType('quantity');
      } else if (editingHabit.unitLabel !== 'session' || (editingHabit.targetUnits && editingHabit.targetUnits > 1)) {
        setTargetType('count');
      } else {
        setTargetType('binary');
      }
    } else if (initialTemplate) {
      setName(initialTemplate.name || '');
      setIcon(initialTemplate.icon || '🌱');
      setCategory(initialTemplate.category || 'Health & Energy');
      setFrequency(initialTemplate.frequency || 'daily');
      setTimeOfDay(initialTemplate.timeOfDay || 'morning');
      setTargetUnits(String(initialTemplate.targetUnits || 1));
      setUnitLabel(initialTemplate.unitLabel || 'session');
      setWhy(initialTemplate.why || '');
      const label = (initialTemplate.unitLabel || '').toLowerCase();
      if (label === 'mins' || label === 'hours' || label === 'minutes') {
        setTargetType('duration');
      } else if (['ml', 'l', 'glasses', 'cups'].includes(label)) {
        setTargetType('quantity');
      } else if (initialTemplate.unitLabel !== 'session' || (initialTemplate.targetUnits && initialTemplate.targetUnits > 1)) {
        setTargetType('count');
      } else {
        setTargetType('binary');
      }
    } else {
      setName('');
      setIcon('🌱');
      setCategory('Health & Energy');
      setFrequency('daily');
      setTimeOfDay('morning');
      setTargetType('binary');
      setTargetUnits('1');
      setUnitLabel('session');
      setWhy('');
      setCustomDays([1, 2, 3, 4, 5]);
    }
    setErrorText('');
  }, [editingHabit, initialTemplate, isOpen]);

  const handleTargetTypeChange = (type: 'binary' | 'duration' | 'quantity' | 'count') => {
    setTargetType(type);
    setErrorText('');
    if (type === 'binary') {
      setTargetUnits('1');
      setUnitLabel('session');
    } else if (type === 'duration') {
      const cur = parseFloat(targetUnits);
      setTargetUnits(cur > 0 && cur !== 1 ? String(cur) : '30');
      setUnitLabel(unitLabel && unitLabel !== 'session' && unitLabel !== 'ml' && unitLabel !== 'pages' ? unitLabel : 'mins');
    } else if (type === 'quantity') {
      const cur = parseFloat(targetUnits);
      setTargetUnits(cur > 0 && cur !== 1 ? String(cur) : '2000');
      setUnitLabel(unitLabel && unitLabel !== 'session' && unitLabel !== 'mins' && unitLabel !== 'pages' ? unitLabel : 'ml');
    } else if (type === 'count') {
      const cur = parseFloat(targetUnits);
      setTargetUnits(cur > 0 && cur !== 1 ? String(cur) : '10');
      setUnitLabel(unitLabel && unitLabel !== 'session' && unitLabel !== 'mins' && unitLabel !== 'ml' ? unitLabel : 'pages');
    }
  };

  const toggleCustomDay = (dayIndex: number) => {
    setCustomDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorText('Habit name is required.');
      return;
    }

    let parsedTargetUnits = 1;
    let finalUnitLabel = 'session';

    if (targetType === 'binary') {
      parsedTargetUnits = 1;
      finalUnitLabel = 'session';
    } else if (targetType === 'duration') {
      parsedTargetUnits = parseFloat(targetUnits);
      if (isNaN(parsedTargetUnits) || parsedTargetUnits <= 0) {
        setErrorText('Please enter a valid positive duration value.');
        return;
      }
      finalUnitLabel = unitLabel.trim() || 'mins';
    } else if (targetType === 'quantity') {
      parsedTargetUnits = parseFloat(targetUnits);
      if (isNaN(parsedTargetUnits) || parsedTargetUnits <= 0) {
        setErrorText('Please enter a valid positive quantity.');
        return;
      }
      if (!unitLabel.trim()) {
        setErrorText('Please enter a unit label for the quantity (e.g. ml, glasses).');
        return;
      }
      finalUnitLabel = unitLabel.trim();
    } else if (targetType === 'count') {
      parsedTargetUnits = parseFloat(targetUnits);
      if (isNaN(parsedTargetUnits) || parsedTargetUnits <= 0) {
        setErrorText('Please enter a valid positive count.');
        return;
      }
      if (!unitLabel.trim()) {
        setErrorText('Please enter a unit label for the count (e.g. pages, reps).');
        return;
      }
      finalUnitLabel = unitLabel.trim();
    }

    if (frequency === 'custom' && customDays.length === 0) {
      setErrorText('Please select at least one day for your custom schedule.');
      return;
    }

    setIsSubmitting(true);
    setErrorText('');
    try {
      const dto: CreateHabitDTO = {
        name: name.trim(),
        routine: name.trim(),
        category,
        frequency,
        timeOfDay,
        targetUnits: parsedTargetUnits,
        unitLabel: finalUnitLabel,
        why: why.trim(),
        icon,
        customDaysOfWeek: frequency === 'custom' ? customDays : undefined,
      };
      const result = await onSave(dto);
      if (result !== false) {
        onClose();
      }
    } catch (err: any) {
      setErrorText(err.message || 'Failed to save habit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editingHabit ? 'Edit Habit' : 'Create New Habit'}
      description="Make today's action small and specific. Small actions compound into lifelong traits."
      contentClassName="p-0 flex flex-col flex-1 min-h-0"
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        {/* Scrollable Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4">
          {errorText && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-medium border border-rose-500/20">
              {errorText}
            </div>
          )}

          {/* Step 1: What do you want to do? */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-800 dark:text-[#F0EEE6]">
              What small action do you want to repeat?
            </label>
            <div className="flex gap-2">
              <div className="relative shrink-0">
                <span className="flex items-center justify-center h-10 w-10 text-lg rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#202A2E]">
                  {icon}
                </span>
              </div>
              <Input
                placeholder="e.g. Drink 2L of Water, Read 10 Pages..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 text-xs sm:text-sm"
                required
                autoFocus
              />
            </div>

            {/* Quick Emoji Strip */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-neutral-400 dark:text-[#707A75] mr-0.5">Icon:</span>
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcon(em)}
                  className={`h-7 w-7 rounded-lg text-xs flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                    icon === em
                      ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-700 scale-105'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Category & Time of Day */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-800 dark:text-[#F0EEE6]">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white dark:bg-[#202A2E] text-neutral-800 dark:text-[#F0EEE6] focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[42px]"
              >
                <option value="Health & Energy">Health & Energy</option>
                <option value="Mind & Peace">Mind & Peace</option>
                <option value="Growth & Mind">Growth & Mind</option>
                <option value="Career & Craft">Career & Craft</option>
                <option value="Daily Living">Daily Living</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-800 dark:text-[#F0EEE6]">
                Time of Day
              </label>
              <select
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value as HabitTimeOfDay)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] bg-white dark:bg-[#202A2E] text-neutral-800 dark:text-[#F0EEE6] focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[42px]"
              >
                <option value="morning">Morning 🌅</option>
                <option value="afternoon">Afternoon ☀️</option>
                <option value="evening">Evening 🌙</option>
                <option value="anytime">Anytime ⏱️</option>
              </select>
            </div>
          </div>

          {/* Step 2: How often? */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-800 dark:text-[#F0EEE6]">
              Frequency
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'daily', label: 'Daily' },
                { id: 'weekdays', label: 'Weekdays' },
                { id: 'weekends', label: 'Weekends' },
                { id: 'custom', label: 'Custom' },
              ].map((freq) => (
                <button
                  key={freq.id}
                  type="button"
                  onClick={() => setFrequency(freq.id as HabitFrequency)}
                  className={`py-2 px-2 text-xs font-medium rounded-xl border transition-all cursor-pointer min-h-[40px] flex items-center justify-center text-center ${
                    frequency === freq.id
                      ? 'border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold shadow-2xs'
                      : 'border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>

            {frequency === 'custom' && (
              <div className="pt-2 flex gap-1 justify-between">
                {WEEKDAYS.map((day) => {
                  const isSelected = customDays.includes(day.idx);
                  return (
                    <button
                      key={day.idx}
                      type="button"
                      title={day.name}
                      onClick={() => toggleCustomDay(day.idx)}
                      className={`h-9 flex-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-500'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 3: What's your target? */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-neutral-800 dark:text-[#F0EEE6]">
              Target & Goal Model
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: 'binary', label: 'Done / Not' },
                { id: 'duration', label: 'Duration' },
                { id: 'quantity', label: 'Quantity' },
                { id: 'count', label: 'Count' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTargetTypeChange(t.id as any)}
                  className={`py-2 px-2 text-xs font-medium rounded-xl border transition-all cursor-pointer min-h-[40px] flex items-center justify-center text-center ${
                    targetType === t.id
                      ? 'border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold shadow-2xs'
                      : 'border-neutral-200/80 dark:border-[rgba(240,238,230,0.08)] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {targetType === 'duration' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <Input
                  label="Target Duration"
                  type="number"
                  min="1"
                  placeholder="30"
                  value={targetUnits}
                  onChange={(e) => setTargetUnits(e.target.value)}
                  required
                />
                <Input
                  label="Duration Unit"
                  placeholder="e.g. mins, hours"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                />
              </div>
            )}

            {targetType === 'quantity' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <Input
                  label="Target Quantity"
                  type="number"
                  min="1"
                  placeholder="2000"
                  value={targetUnits}
                  onChange={(e) => setTargetUnits(e.target.value)}
                  required
                />
                <Input
                  label="Unit Label (required)"
                  placeholder="e.g. ml, glasses, L, cups"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  required
                />
              </div>
            )}

            {targetType === 'count' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <Input
                  label="Target Count"
                  type="number"
                  min="1"
                  placeholder="10"
                  value={targetUnits}
                  onChange={(e) => setTargetUnits(e.target.value)}
                  required
                />
                <Input
                  label="Unit Label (required)"
                  placeholder="e.g. pages, reps, times"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {/* Optional: Why does it matter? */}
          <div className="space-y-1.5 pt-1 pb-2">
            <label className="text-xs font-semibold text-neutral-800 dark:text-[#F0EEE6] flex items-center justify-between">
              <span>Why does this matter to you?</span>
              <span className="text-[10px] font-normal text-neutral-400">Optional</span>
            </label>
            <Input
              placeholder="e.g. I want more physical energy for my family & creative craft."
              value={why}
              onChange={(e) => setWhy(e.target.value)}
            />
          </div>
        </div>

        {/* Stable Pinned Action Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2.5 px-4 sm:px-6 py-3.5 border-t border-neutral-100 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[42px] px-4 text-xs sm:text-sm font-medium"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[42px] px-5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white dark:text-neutral-950 font-semibold text-xs sm:text-sm border-0 shadow-xs"
          >
            {isSubmitting ? (
              'Saving...'
            ) : editingHabit ? (
              'Update Habit'
            ) : (
              'Create Habit'
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
