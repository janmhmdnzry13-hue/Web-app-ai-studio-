import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { aiMemoryService } from '../../services/ai/memory.service';
import { AIMemoryItem } from '../../types/ai.types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Plus, Trash2, ShieldCheck, Sparkles, Brain } from 'lucide-react';

interface AIMemoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIMemoryManagerModal({ isOpen, onClose }: AIMemoryManagerModalProps) {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [memories, setMemories] = useState<AIMemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Form state for adding new memory
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newKey, setNewKey] = useState<string>('');
  const [newValue, setNewValue] = useState<string>('');
  const [newCategory, setNewCategory] = useState<AIMemoryItem['category']>('planning');

  const loadMemories = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const res = await aiMemoryService.getMemories(user.id);
      if (res.success && res.data) {
        setMemories([...res.data]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMemories();
      setIsAdding(false);
      setNewKey('');
      setNewValue('');
    }
  }, [isOpen, user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !newKey.trim() || !newValue.trim()) return;

    const res = await aiMemoryService.saveMemory(user.id, newKey, newValue, newCategory);
    if (res.success) {
      success('Preference Saved', `AI will factor in "${newKey}"`);
      setNewKey('');
      setNewValue('');
      setIsAdding(false);
      loadMemories();
    } else {
      error('Save Failed', res.error?.message || 'Could not save memory');
    }
  };

  const handleDelete = async (id: string, key: string) => {
    if (!user?.id) return;
    const res = await aiMemoryService.deleteMemory(user.id, id);
    if (res.success) {
      success('Memory Deleted', `Removed preference "${key}"`);
      loadMemories();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Memory & Preferences"
      description="Transparent, user-scoped guidelines that the AI assistant references when planning and organizing."
      size="md"
    >
      <div className="space-y-5">
        {/* Epistemological/Privacy Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
            ORIGIN AI memory is strictly transparent and scoped to your profile. The AI only retains preferences you explicitly define here or confirm.
          </p>
        </div>

        {/* Existing Memories List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-purple-500" />
              <span>Active Memory Directives ({memories.length})</span>
            </h4>
            {!isAdding && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 px-2"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setIsAdding(true)}
              >
                Add Directive
              </Button>
            )}
          </div>

          {memories.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-400 border border-dashed rounded-xl">
              No custom AI memory directives set.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {memories.map((mem) => (
                <div
                  key={mem.id}
                  className="flex items-start justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {mem.key}
                      </span>
                      <Badge variant="subtle" size="sm" className="capitalize">
                        {mem.category}
                      </Badge>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 line-clamp-2">
                      {mem.value}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(mem.id, mem.key)}
                    aria-label={`Delete memory ${mem.key}`}
                    className="p-1 text-neutral-400 hover:text-red-500 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Memory Form */}
        {isAdding && (
          <form onSubmit={handleSave} className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/20 space-y-3">
            <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              <span>Add New AI Directive</span>
            </h5>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Directive Name / Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. Preferred Deep Work Time"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Guideline / Preference
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Schedule high-leverage coding tasks between 9am and 11am."
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="planning">Daily Planning</option>
                  <option value="routine">Habit & Routine</option>
                  <option value="financial">Financial Rules</option>
                  <option value="wellness">Wellness & Reflection</option>
                  <option value="general">General Life Philosophy</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7 px-2.5"
                type="button"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs h-7 px-3 bg-purple-600 hover:bg-purple-700 text-white"
                type="submit"
              >
                Save Directive
              </Button>
            </div>
          </form>
        )}

        <div className="flex justify-end pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
