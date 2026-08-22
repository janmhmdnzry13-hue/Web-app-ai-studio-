import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { noteService } from '../../services/note.service';
import { CreateNoteDTO, Note, UpdateNoteDTO } from '../../types/note.types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import {
  FileText,
  Pin,
  Archive,
  Search,
  Plus,
  Edit2,
  Trash2,
  Tag,
  BookOpen,
  Calendar,
  Sparkles,
  CheckCircle2,
  Layers,
  RotateCcw,
} from 'lucide-react';

export function NotesOverview() {
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Create/Edit Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteForm, setNoteForm] = useState<{
    title: string;
    content: string;
    tagInput: string;
    tags: string[];
    isPinned: boolean;
  }>({
    title: '',
    content: '',
    tagInput: '',
    tags: [],
    isPinned: false,
  });

  // Selected note for full reading view
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const loadNotes = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const res = await noteService.getNotes(user.id, {
        isArchived: activeTab === 'archived',
        search: searchQuery,
        tag: selectedTag || undefined,
      });
      if (res.success && res.data) {
        setNotes([...res.data]);
      }
    } catch {
      error('Error', 'Failed to fetch notes repository.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, activeTab, searchQuery, selectedTag, error]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Extract all unique tags across notes
  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags || [])));

  // Open Create Note Modal
  const openCreateModal = () => {
    setEditingNote(null);
    setNoteForm({
      title: '',
      content: '',
      tagInput: '',
      tags: [],
      isPinned: false,
    });
    setIsNoteModalOpen(true);
  };

  // Open Edit Note Modal
  const openEditModal = (note: Note) => {
    setEditingNote(note);
    setNoteForm({
      title: note.title,
      content: note.content,
      tagInput: '',
      tags: [...note.tags],
      isPinned: note.isPinned,
    });
    setIsNoteModalOpen(true);
  };

  const handleAddTag = () => {
    if (noteForm.tagInput.trim() && !noteForm.tags.includes(noteForm.tagInput.trim())) {
      setNoteForm((prev) => ({
        ...prev,
        tags: [...prev.tags, prev.tagInput.trim()],
        tagInput: '',
      }));
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNoteForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  // Save Note (Create or Update)
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!noteForm.title.trim()) {
      error('Required Field', 'Note title is required.');
      return;
    }

    try {
      if (editingNote) {
        const res = await noteService.updateNote(user.id, editingNote.id, {
          title: noteForm.title.trim(),
          content: noteForm.content,
          tags: noteForm.tags,
          isPinned: noteForm.isPinned,
        });
        if (res.success && res.data) {
          success('Note Saved', `"${res.data.title}" updated successfully.`);
          setIsNoteModalOpen(false);
          if (selectedNote?.id === editingNote.id) {
            setSelectedNote(res.data);
          }
          loadNotes();
        }
      } else {
        const res = await noteService.createNote(user.id, {
          title: noteForm.title.trim(),
          content: noteForm.content,
          tags: noteForm.tags,
          isPinned: noteForm.isPinned,
        });
        if (res.success && res.data) {
          success('Note Created', `"${res.data.title}" saved to knowledge base.`);
          setIsNoteModalOpen(false);
          loadNotes();
        }
      }
    } catch {
      error('Error', 'Failed to save note.');
    }
  };

  // Toggle Pin
  const handleTogglePin = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    if (!user?.id) return;
    const res = await noteService.togglePin(user.id, note.id);
    if (res.success) {
      info(note.isPinned ? 'Unpinned' : 'Pinned to Top', `Note "${note.title}" pin state updated.`);
      loadNotes();
    }
  };

  // Toggle Archive
  const handleToggleArchive = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    if (!user?.id) return;
    const res = await noteService.toggleArchive(user.id, note.id);
    if (res.success) {
      info(note.isArchived ? 'Restored Note' : 'Archived Note', `Note "${note.title}" archive state changed.`);
      if (selectedNote?.id === note.id) {
        setSelectedNote(null);
      }
      loadNotes();
    }
  };

  // Delete Note
  const handleDeleteNote = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    if (!user?.id) return;
    const res = await noteService.deleteNote(user.id, note.id);
    if (res.success) {
      info('Deleted', `Note "${note.title}" removed.`);
      if (selectedNote?.id === note.id) {
        setSelectedNote(null);
      }
      loadNotes();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Page Header */}
      <PageHeader
        title="Notes & Knowledge Base"
        description="Persistent Markdown documents, tag categorizations, word counters, and linkable knowledge graph."
        badge={{ label: 'Markdown Ready', variant: 'primary' }}
        breadcrumbs={[{ label: 'ORIGIN' }, { label: 'Notes' }]}
        actions={
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
            New Note
          </Button>
        }
      />

      {/* Filter and Tab Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Active / Archive Toggle */}
          <div className="flex items-center p-0.5 bg-neutral-200/60 dark:bg-neutral-800 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'active'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Active Notes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'archived'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Archived
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search content or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${
                selectedTag === null
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${
                  selectedTag === tag
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notes Grid */}
      {notes.length === 0 ? (
        <Card className="p-12 text-center text-xs text-neutral-400 space-y-3">
          <FileText className="h-8 w-8 mx-auto text-neutral-300 dark:text-neutral-700" />
          <p>{activeTab === 'active' ? 'No active notes found.' : 'No archived notes.'}</p>
          {activeTab === 'active' && (
            <Button size="sm" variant="outline" onClick={openCreateModal}>
              Write First Note
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {notes.map((note) => (
            <Card
              key={note.id}
              className={`p-5 space-y-3.5 flex flex-col justify-between hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer ${
                note.isPinned ? 'ring-1 ring-neutral-300 dark:ring-neutral-700 bg-neutral-50/40 dark:bg-neutral-900/40' : ''
              }`}
              onClick={() => setSelectedNote(note)}
            >
              <div className="space-y-2">
                {/* Note Header & Action Controls */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2">
                    {note.title}
                  </h4>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(e, note)}
                      title={note.isPinned ? 'Unpin' : 'Pin to Top'}
                      className={`p-1 rounded transition-colors ${
                        note.isPinned
                          ? 'text-neutral-900 dark:text-neutral-100 font-bold'
                          : 'text-neutral-400 hover:text-neutral-700'
                      }`}
                    >
                      <Pin className={`h-3.5 w-3.5 ${note.isPinned ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleToggleArchive(e, note)}
                      title={note.isArchived ? 'Unarchive' : 'Archive'}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      {note.isArchived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(note);
                      }}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteNote(e, note)}
                      className="p-1 rounded text-neutral-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Summary / Snippet */}
                <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed">
                  {note.plainTextSummary || note.content}
                </p>
              </div>

              {/* Tags & Footer Metadata */}
              <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>{note.wordCount} words</span>
                  <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View Full Note Modal */}
      {selectedNote && (
        <Modal
          isOpen={!!selectedNote}
          onClose={() => setSelectedNote(null)}
          title={selectedNote.title}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-neutral-500 pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <span>{selectedNote.wordCount} words</span>
                <span>•</span>
                <span>Last edited: {new Date(selectedNote.updatedAt).toLocaleString()}</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Edit2 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    const n = selectedNote;
                    setSelectedNote(null);
                    openEditModal(n);
                  }}
                >
                  Edit Note
                </Button>
              </div>
            </div>

            {/* Note Content View */}
            <div className="text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap font-mono bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 max-h-96 overflow-y-auto leading-relaxed">
              {selectedNote.content}
            </div>

            {selectedNote.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedNote.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="outline" size="sm" onClick={() => setSelectedNote(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create / Edit Note Modal */}
      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title={editingNote ? 'Edit Knowledge Document' : 'Create Note Document'}
      >
        <form onSubmit={handleSaveNote} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Title *
            </label>
            <Input
              type="text"
              placeholder="e.g. Distributed Consensus Axioms"
              value={noteForm.title}
              onChange={(e) => setNoteForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Document Content (Markdown format supported)
            </label>
            <textarea
              rows={8}
              placeholder="Write Markdown thoughts, architecture specs, or quick takeaways..."
              value={noteForm.content}
              onChange={(e) => setNoteForm((prev) => ({ ...prev, content: e.target.value }))}
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              Tags
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g. Systems, Longevity"
                value={noteForm.tagInput}
                onChange={(e) => setNoteForm((prev) => ({ ...prev, tagInput: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
                Add Tag
              </Button>
            </div>
            {noteForm.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {noteForm.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-neutral-400 hover:text-neutral-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isPinnedNote"
              checked={noteForm.isPinned}
              onChange={(e) => setNoteForm((prev) => ({ ...prev, isPinned: e.target.checked }))}
              className="rounded border-neutral-300 text-neutral-900 focus:ring-0"
            />
            <label htmlFor="isPinnedNote" className="text-xs text-neutral-700 dark:text-neutral-300">
              Pin note to top of list
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setIsNoteModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingNote ? 'Update Note' : 'Save Note'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
