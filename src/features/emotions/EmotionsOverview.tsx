import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { emotionService } from '../../services/emotion.service';
import {
  CreateReflectionDTO,
  EmotionReflectionEntry,
  PrimaryEmotion,
  RatingScale1To5,
  ReflectionTrendSummary,
} from '../../types/emotion.types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import {
  HeartHandshake,
  Sparkles,
  Flame,
  Sun,
  ShieldCheck,
  Calendar,
  Smile,
  Zap,
  Activity,
  Trash2,
  Lock,
  Plus,
  BookOpen,
  Info,
} from 'lucide-react';

const EMOTION_OPTIONS: { id: PrimaryEmotion; label: string; emoji: string }[] = [
  { id: 'calm', label: 'Calm', emoji: '🌿' },
  { id: 'focused', label: 'Focused', emoji: '🎯' },
  { id: 'energized', label: 'Energized', emoji: '⚡' },
  { id: 'grateful', label: 'Grateful', emoji: '🙏' },
  { id: 'joyful', label: 'Joyful', emoji: '✨' },
  { id: 'neutral', label: 'Neutral', emoji: '⚖️' },
  { id: 'reflective', label: 'Reflective', emoji: '🌌' },
  { id: 'fatigued', label: 'Fatigued', emoji: '🔋' },
  { id: 'anxious', label: 'Anxious', emoji: '🌪️' },
  { id: 'frustrated', label: 'Frustrated', emoji: '🛑' },
  { id: 'overwhelmed', label: 'Overwhelmed', emoji: '🌊' },
];

export function EmotionsOverview() {
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const [reflections, setReflections] = useState<EmotionReflectionEntry[]>([]);
  const [trends, setTrends] = useState<ReflectionTrendSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Today's Form State
  const todayDateStr = new Date().toISOString().split('T')[0];
  const [formDate, setFormDate] = useState<string>(todayDateStr);
  const [mood, setMood] = useState<RatingScale1To5>(4);
  const [energy, setEnergy] = useState<RatingScale1To5>(4);
  const [stress, setStress] = useState<RatingScale1To5>(2);
  const [primaryEmotion, setPrimaryEmotion] = useState<PrimaryEmotion>('focused');
  const [reflectionText, setReflectionText] = useState<string>('');
  const [journalEntry, setJournalEntry] = useState<string>('');
  const [tagInput, setTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>(['clarity']);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Detail Modal State
  const [selectedEntry, setSelectedEntry] = useState<EmotionReflectionEntry | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [listRes, trendsRes, todayRes] = await Promise.all([
        emotionService.getReflections(user.id),
        emotionService.getReflectionTrends(user.id, 30),
        emotionService.getReflectionByDate(user.id, formDate),
      ]);

      if (listRes.success && listRes.data) {
        setReflections([...listRes.data]);
      }
      if (trendsRes.success && trendsRes.data) {
        setTrends(trendsRes.data);
      }
      if (todayRes.success && todayRes.data) {
        const entry = todayRes.data;
        setMood(entry.mood);
        setEnergy(entry.energy);
        setStress(entry.stress);
        setPrimaryEmotion(entry.primaryEmotion || 'focused');
        setReflectionText(entry.reflection);
        setJournalEntry(entry.journalEntry || '');
        setTags([...entry.tags]);
      }
    } catch {
      error('Error', 'Failed to load reflection history.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, formDate, error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Save Reflection
  const handleSaveReflection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!reflectionText.trim()) {
      error('Required Field', 'Please enter a brief daily reflection or core takeaway.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await emotionService.logReflection(user.id, {
        date: formDate,
        mood,
        energy,
        stress,
        primaryEmotion,
        reflection: reflectionText.trim(),
        journalEntry: journalEntry.trim() || undefined,
        tags,
      });

      if (res.success) {
        success('Reflection Recorded', `Check-in for ${formDate} saved privately.`);
        loadData();
      } else {
        error('Save Failed', res.error?.message || 'Could not save reflection.');
      }
    } catch {
      error('Error', 'An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleDeleteEntry = async (id: string, dateStr: string) => {
    if (!user?.id) return;
    const res = await emotionService.deleteReflection(user.id, id);
    if (res.success) {
      info('Deleted', `Removed reflection for ${dateStr}.`);
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }
      loadData();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Page Header */}
      <PageHeader
        title="Emotions & Energy Reflection"
        description="Sovereign daily check-ins for mood, circadian energy, stress scores, and private evening journaling."
        badge={{ label: 'Private & Localized', variant: 'subtle' }}
        breadcrumbs={[{ label: 'ORIGIN' }, { label: 'Emotions & Reflection' }]}
      />

      {/* Non-Diagnostic Clinical & Privacy Notice Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-neutral-800 dark:text-neutral-200 text-xs">
        <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-neutral-900 dark:text-neutral-100">
            Personal Reflection & Data Privacy Safeguard
          </p>
          <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
            ORIGIN reflections are private, self-reported introspections for personal awareness.
            This module does not diagnose conditions or offer clinical medical advice. All entries are encrypted in your private operator storage.
          </p>
        </div>
      </div>

      {/* 30-Day Trend Metrics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Mood */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Mood</span>
            <Smile className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {trends?.averageMood ? `${trends.averageMood} / 5` : '—'}
          </p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {trends?.entryCount || 0} recorded sessions
          </p>
        </Card>

        {/* Average Energy */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Energy</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {trends?.averageEnergy ? `${trends.averageEnergy} / 5` : '—'}
          </p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Circadian vitality metric
          </p>
        </Card>

        {/* Average Stress */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Stress</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {trends?.averageStress ? `${trends.averageStress} / 5` : '—'}
          </p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            1 = Very Calm, 5 = High Stress
          </p>
        </Card>

        {/* Reflection Streak */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Current Streak</span>
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {trends?.streakDays || 0} Days
          </p>
          <p className="text-[11px] text-orange-600 dark:text-orange-400 mt-0.5 font-medium">
            Daily introspective ritual
          </p>
        </Card>
      </div>

      {/* Main Grid: Check-In Form (Left) & Recent Reflections Log (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Daily Check-In Form */}
        <div className="lg:col-span-6 space-y-6">
          <Card className="p-6">
            <CardHeader className="p-0 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Daily Check-In & Journal</CardTitle>
                  <CardDescription className="text-xs">
                    Log valence scores and reflections for the selected date.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="text-xs px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>
            </CardHeader>

            <form onSubmit={handleSaveReflection} className="space-y-5">
              {/* Mood Scale (1 to 5) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Mood / Wellbeing</span>
                  <span className="font-mono text-neutral-900 dark:text-neutral-100">{mood} of 5</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMood(val as RatingScale1To5)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                        mood === val
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {val} {val === 1 ? '😔' : val === 3 ? '😐' : val === 5 ? '😄' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy Scale (1 to 5) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Energy & Vitality</span>
                  <span className="font-mono text-neutral-900 dark:text-neutral-100">{energy} of 5</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEnergy(val as RatingScale1To5)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                        energy === val
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {val} {val === 1 ? '🪫' : val === 5 ? '⚡' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stress Level (1 to 5) */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Stress Pressure (1 = Calm, 5 = High)</span>
                  <span className="font-mono text-neutral-900 dark:text-neutral-100">{stress} of 5</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setStress(val as RatingScale1To5)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                        stress === val
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {val} {val === 1 ? '🧘' : val === 5 ? '🔥' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dominant Primary Emotion Chips */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Dominant Emotion / State
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPrimaryEmotion(opt.id)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-all flex items-center gap-1.5 ${
                        primaryEmotion === opt.id
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 font-medium'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Core Reflection Summary */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Core Daily Reflection / Takeaway *
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Strong focus on design; felt energized after afternoon exercise."
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  required
                />
              </div>

              {/* Freeform Journal Entry */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Private Journal Entry (Optional)
                </label>
                <textarea
                  rows={4}
                  placeholder="Elaborate on events, insights, cognitive blockers, or gratitude points..."
                  value={journalEntry}
                  onChange={(e) => setJournalEntry(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Contextual Tags
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="e.g. deep_work, sleep_8h, walk"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? 'Saving Reflection...' : `Save Reflection for ${formDate}`}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Historical Reflections List */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Reflections Archive
            </h3>
            <span className="text-xs text-neutral-500">
              {reflections.length} total entries
            </span>
          </div>

          {reflections.length === 0 ? (
            <Card className="p-8 text-center text-xs text-neutral-400">
              No historical reflections recorded yet. Use the check-in form to start your private log.
            </Card>
          ) : (
            <div className="space-y-3">
              {reflections.map((entry) => {
                const emotionObj = EMOTION_OPTIONS.find((e) => e.id === entry.primaryEmotion);
                return (
                  <Card
                    key={entry.id}
                    className="p-4 space-y-3 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors cursor-pointer"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{emotionObj?.emoji || '🌌'}</span>
                        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                          {entry.date}
                        </span>
                        <Badge variant="subtle" size="sm">
                          {emotionObj?.label || entry.primaryEmotion || 'Reflective'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-emerald-600 dark:text-emerald-400">M:{entry.mood}</span>
                        <span className="text-amber-500">E:{entry.energy}</span>
                        <span className="text-blue-500">S:{entry.stress}</span>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-700 dark:text-neutral-300 font-medium line-clamp-2">
                      {entry.reflection}
                    </p>

                    {entry.journalEntry && (
                      <p className="text-[11px] text-neutral-500 italic line-clamp-1">
                        &quot;{entry.journalEntry}&quot;
                      </p>
                    )}

                    {entry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {entry.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Entry Details & Full Journal Modal */}
      {selectedEntry && (
        <Modal
          isOpen={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
          title={`Reflection: ${selectedEntry.date}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl text-center">
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400">Mood</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {selectedEntry.mood} / 5
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400">Energy</p>
                <p className="text-lg font-bold text-amber-500 mt-0.5">
                  {selectedEntry.energy} / 5
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-neutral-400">Stress</p>
                <p className="text-lg font-bold text-blue-500 mt-0.5">
                  {selectedEntry.stress} / 5
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                Reflection Summary
              </h4>
              <p className="text-xs text-neutral-900 dark:text-neutral-100 bg-neutral-50 dark:bg-neutral-900/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
                {selectedEntry.reflection}
              </p>
            </div>

            {selectedEntry.journalEntry && (
              <div>
                <h4 className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-1">
                  Private Journal Log
                </h4>
                <div className="text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-900/50 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 leading-relaxed font-serif">
                  {selectedEntry.journalEntry}
                </div>
              </div>
            )}

            {selectedEntry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedEntry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => handleDeleteEntry(selectedEntry.id, selectedEntry.date)}
              >
                Delete Entry
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedEntry(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
