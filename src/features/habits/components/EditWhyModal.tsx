import React, { useState } from 'react';
import { Dialog } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { Sparkles, Heart } from 'lucide-react';

interface EditWhyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWhy: string;
  onSave: (newWhy: string) => void;
}

export function EditWhyModal({
  isOpen,
  onClose,
  currentWhy,
  onSave,
}: EditWhyModalProps) {
  const [whyText, setWhyText] = useState(currentWhy);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(whyText.trim());
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Personalize 'Your Why'"
      description="Connect your daily habits to the person you want to become. Habits stick when they reinforce your identity."
    >
      <form onSubmit={handleSave} className="space-y-4 py-2">
        <Textarea
          label="Why do you build daily habits?"
          value={whyText}
          onChange={(e) => setWhyText(e.target.value)}
          placeholder="e.g. I build habits so I can have more energy to create, help others, and live freely."
          rows={4}
          required
        />

        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
          <Heart className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="leading-relaxed">
            James Clear once wrote: &ldquo;Every action you take is a vote for the type of person you wish to become.&rdquo;
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">
            Save Your Why
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
