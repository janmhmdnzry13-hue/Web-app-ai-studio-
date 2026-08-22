import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { relationshipService } from '../../services/relationship.service';
import {
  CreateRelationshipDTO,
  ImportantDate,
  InteractionLog,
  Relationship,
  RelationshipType,
} from '../../types/relationship.types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import {
  Users,
  UserPlus,
  Heart,
  Phone,
  MessageSquare,
  Video,
  Clock,
  Calendar,
  Sparkles,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Gift,
  Search,
} from 'lucide-react';

const RELATIONSHIP_TYPES: { id: RelationshipType; label: string }[] = [
  { id: 'partner', label: 'Life Partner' },
  { id: 'family', label: 'Family' },
  { id: 'close_friend', label: 'Close Friend' },
  { id: 'friend', label: 'Friend' },
  { id: 'colleague', label: 'Colleague' },
  { id: 'mentor', label: 'Mentor / Advisor' },
  { id: 'community', label: 'Community' },
  { id: 'other', label: 'Other' },
];

export function RelationshipsOverview() {
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [filterType, setFilterType] = useState<RelationshipType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Add/Edit Contact Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState<boolean>(false);
  const [editingRel, setEditingRel] = useState<Relationship | null>(null);
  const [contactForm, setContactForm] = useState<{
    name: string;
    relationshipType: RelationshipType;
    cadenceDays: string;
    notes: string;
    lastInteraction: string;
    importantDateLabel: string;
    importantDateValue: string;
    importantDates: ImportantDate[];
  }>({
    name: '',
    relationshipType: 'friend',
    cadenceDays: '14',
    notes: '',
    lastInteraction: new Date().toISOString().split('T')[0],
    importantDateLabel: 'Birthday',
    importantDateValue: '',
    importantDates: [],
  });

  // Log Interaction Modal State
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState<boolean>(false);
  const [targetRel, setTargetRel] = useState<Relationship | null>(null);
  const [interactionForm, setInteractionForm] = useState<{
    type: 'call' | 'in_person' | 'message' | 'letter_gift' | 'shared_activity' | 'video';
    date: string;
    notes: string;
  }>({
    type: 'call',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const res = await relationshipService.getRelationships(user.id);
      if (res.success && res.data) {
        setRelationships([...res.data]);
      }
    } catch {
      error('Error', 'Failed to load relationship records.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Relationships
  const filteredRelationships = relationships.filter((r) => {
    const matchesType = filterType === 'all' || r.relationshipType === filterType;
    const matchesSearch =
      !searchQuery.trim() ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      r.notes?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      r.relationshipType.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesType && matchesSearch;
  });

  // Open Create Modal
  const openCreateModal = () => {
    setEditingRel(null);
    setContactForm({
      name: '',
      relationshipType: 'friend',
      cadenceDays: '14',
      notes: '',
      lastInteraction: new Date().toISOString().split('T')[0],
      importantDateLabel: 'Birthday',
      importantDateValue: '',
      importantDates: [],
    });
    setIsContactModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (rel: Relationship) => {
    setEditingRel(rel);
    setContactForm({
      name: rel.name,
      relationshipType: rel.relationshipType,
      cadenceDays: (rel.cadenceDays || 14).toString(),
      notes: rel.notes || '',
      lastInteraction: rel.lastInteraction || new Date().toISOString().split('T')[0],
      importantDateLabel: 'Birthday',
      importantDateValue: '',
      importantDates: [...rel.importantDates],
    });
    setIsContactModalOpen(true);
  };

  const handleAddImportantDate = () => {
    if (contactForm.importantDateLabel.trim() && contactForm.importantDateValue.trim()) {
      const newDate: ImportantDate = {
        id: `dt_${Date.now()}`,
        label: contactForm.importantDateLabel.trim(),
        date: contactForm.importantDateValue.trim(),
        recurringYearly: true,
      };
      setContactForm((prev) => ({
        ...prev,
        importantDates: [...prev.importantDates, newDate],
        importantDateValue: '',
      }));
    }
  };

  const handleRemoveImportantDate = (id: string) => {
    setContactForm((prev) => ({
      ...prev,
      importantDates: prev.importantDates.filter((d) => d.id !== id),
    }));
  };

  // Handle Save Contact
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!contactForm.name.trim()) {
      error('Required Field', 'Please enter a contact name.');
      return;
    }

    const cadence = parseInt(contactForm.cadenceDays, 10) || 14;

    try {
      if (editingRel) {
        const res = await relationshipService.updateRelationship(user.id, editingRel.id, {
          name: contactForm.name.trim(),
          relationshipType: contactForm.relationshipType,
          cadenceDays: cadence,
          notes: contactForm.notes.trim() || undefined,
          importantDates: contactForm.importantDates,
          lastInteraction: contactForm.lastInteraction,
        });
        if (res.success) {
          success('Updated', `Relationship with ${contactForm.name} updated.`);
          setIsContactModalOpen(false);
          loadData();
        }
      } else {
        const res = await relationshipService.createRelationship(user.id, {
          name: contactForm.name.trim(),
          relationshipType: contactForm.relationshipType,
          cadenceDays: cadence,
          notes: contactForm.notes.trim() || undefined,
          importantDates: contactForm.importantDates,
          lastInteraction: contactForm.lastInteraction,
        });
        if (res.success) {
          success('Created', `Added ${contactForm.name} to relationships.`);
          setIsContactModalOpen(false);
          loadData();
        }
      }
    } catch {
      error('Error', 'Failed to save contact.');
    }
  };

  // Handle Delete Contact
  const handleDeleteContact = async (id: string, name: string) => {
    if (!user?.id) return;
    const res = await relationshipService.deleteRelationship(user.id, id);
    if (res.success) {
      info('Deleted', `Removed ${name} from relationships.`);
      loadData();
    }
  };

  // Open Log Interaction Modal
  const openInteractionModal = (rel: Relationship) => {
    setTargetRel(rel);
    setInteractionForm({
      type: 'call',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setIsInteractionModalOpen(true);
  };

  // Handle Save Interaction Log
  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !targetRel) return;

    try {
      const res = await relationshipService.logInteraction(user.id, targetRel.id, {
        type: interactionForm.type,
        date: interactionForm.date,
        notes: interactionForm.notes.trim() || undefined,
      });

      if (res.success) {
        success('Interaction Logged', `Recorded catch-up with ${targetRel.name}.`);
        setIsInteractionModalOpen(false);
        loadData();
      }
    } catch {
      error('Error', 'Failed to log interaction.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Page Header */}
      <PageHeader
        title="Personal Relationships & Circles"
        description="Sovereign relational CRM, check-in cadences, interaction logs, and key anniversaries."
        badge={{ label: 'Private CRM', variant: 'primary' }}
        breadcrumbs={[{ label: 'ORIGIN' }, { label: 'Relationships' }]}
        actions={
          <Button size="sm" leftIcon={<UserPlus className="h-4 w-4" />} onClick={openCreateModal}>
            Add Contact
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Search className="h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-xs px-2.5 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 w-full sm:w-48"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
              filterType === 'all'
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            All Circles
          </button>
          {RELATIONSHIP_TYPES.map((rt) => (
            <button
              key={rt.id}
              type="button"
              onClick={() => setFilterType(rt.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                filterType === rt.id
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {rt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Relationships Grid */}
      {filteredRelationships.length === 0 ? (
        <Card className="p-12 text-center text-xs text-neutral-400 space-y-3">
          <Users className="h-8 w-8 mx-auto text-neutral-300 dark:text-neutral-700" />
          <p>No contacts found matching your criteria.</p>
          <Button size="sm" variant="outline" onClick={openCreateModal}>
            Add First Contact
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRelationships.map((rel) => {
            const todayStr = new Date().toISOString().split('T')[0];
            const isDueSoon = rel.nextReminder && rel.nextReminder <= todayStr;

            return (
              <Card key={rel.id} className="p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  {/* Top Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        {rel.name}
                      </h4>
                      <Badge variant="subtle" size="sm" className="mt-1">
                        {RELATIONSHIP_TYPES.find((t) => t.id === rel.relationshipType)?.label || rel.relationshipType}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(rel)}
                        className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(rel.id, rel.name)}
                        className="p-1 rounded text-neutral-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  {rel.notes && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                      {rel.notes}
                    </p>
                  )}

                  {/* Important Dates */}
                  {rel.importantDates && rel.importantDates.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {rel.importantDates.map((dt) => (
                        <div key={dt.id} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                          <Gift className="h-3 w-3 text-purple-500 shrink-0" />
                          <span>{dt.label}:</span>
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">{dt.date}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interaction Status */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                      <span>Cadence: Every {rel.cadenceDays || 14} days</span>
                      <span>Last: {rel.lastInteraction || 'None'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Next Check-in:
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          isDueSoon ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-900 dark:text-neutral-100'
                        }`}
                      >
                        {rel.nextReminder || 'Not scheduled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Log Interaction Action Button */}
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    leftIcon={<Clock className="h-3.5 w-3.5" />}
                    onClick={() => openInteractionModal(rel)}
                  >
                    Log Interaction ({rel.interactions?.length || 0})
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      <Modal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        title={editingRel ? `Edit: ${editingRel.name}` : 'Add Relationship Contact'}
      >
        <form onSubmit={handleSaveContact} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Full Name *
            </label>
            <Input
              type="text"
              placeholder="e.g. Elena Rostova"
              value={contactForm.name}
              onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Circle / Type
              </label>
              <select
                value={contactForm.relationshipType}
                onChange={(e) =>
                  setContactForm((prev) => ({ ...prev, relationshipType: e.target.value as RelationshipType }))
                }
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                {RELATIONSHIP_TYPES.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Check-in Cadence (Days)
              </label>
              <Input
                type="number"
                min="1"
                placeholder="14"
                value={contactForm.cadenceDays}
                onChange={(e) => setContactForm((prev) => ({ ...prev, cadenceDays: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Last Interaction Date
            </label>
            <Input
              type="date"
              value={contactForm.lastInteraction}
              onChange={(e) => setContactForm((prev) => ({ ...prev, lastInteraction: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Personal Notes & Interests
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Enjoys architectural design, specialty coffee, and distributed systems."
              value={contactForm.notes}
              onChange={(e) => setContactForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          {/* Important Dates Manager */}
          <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Important Anniversaries / Birthdays
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Label (e.g. Birthday)"
                value={contactForm.importantDateLabel}
                onChange={(e) => setContactForm((prev) => ({ ...prev, importantDateLabel: e.target.value }))}
                className="w-1/3"
              />
              <Input
                type="date"
                value={contactForm.importantDateValue}
                onChange={(e) => setContactForm((prev) => ({ ...prev, importantDateValue: e.target.value }))}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddImportantDate}>
                Add
              </Button>
            </div>

            {contactForm.importantDates.length > 0 && (
              <div className="space-y-1 pt-1">
                {contactForm.importantDates.map((dt) => (
                  <div
                    key={dt.id}
                    className="flex items-center justify-between text-xs p-1.5 rounded-md bg-neutral-50 dark:bg-neutral-800/60"
                  >
                    <span>
                      {dt.label}: <strong>{dt.date}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveImportantDate(dt.id)}
                      className="text-rose-500 hover:text-rose-700 text-xs px-1"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setIsContactModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingRel ? 'Update Contact' : 'Save Contact'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Log Interaction Modal */}
      {targetRel && (
        <Modal
          isOpen={isInteractionModalOpen}
          onClose={() => setIsInteractionModalOpen(false)}
          title={`Log Interaction with ${targetRel.name}`}
        >
          <form onSubmit={handleSaveInteraction} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Interaction Medium
                </label>
                <select
                  value={interactionForm.type}
                  onChange={(e) =>
                    setInteractionForm((prev) => ({
                      ...prev,
                      type: e.target.value as any,
                    }))
                  }
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="call">Phone Call</option>
                  <option value="in_person">In-Person Meeting</option>
                  <option value="message">Text / Message</option>
                  <option value="video">Video Call</option>
                  <option value="shared_activity">Shared Activity</option>
                  <option value="letter_gift">Gift / Letter</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Date
                </label>
                <Input
                  type="date"
                  value={interactionForm.date}
                  onChange={(e) => setInteractionForm((prev) => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Summary Notes / Key Topics
              </label>
              <textarea
                rows={3}
                placeholder="What did you discuss? Any follow-up items or life updates?"
                value={interactionForm.notes}
                onChange={(e) => setInteractionForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            {/* Previous History List in Modal */}
            {targetRel.interactions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Past Interactions ({targetRel.interactions.length})
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {targetRel.interactions.map((int) => (
                    <div
                      key={int.id}
                      className="p-2 rounded bg-neutral-50 dark:bg-neutral-800/40 text-[11px] space-y-0.5"
                    >
                      <div className="flex justify-between font-semibold text-neutral-700 dark:text-neutral-300">
                        <span className="capitalize">{int.type.replace('_', ' ')}</span>
                        <span>{int.date}</span>
                      </div>
                      {int.notes && <p className="text-neutral-500">{int.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
              <Button type="button" variant="outline" onClick={() => setIsInteractionModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Record Interaction</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
