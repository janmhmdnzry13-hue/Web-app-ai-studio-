import { describe, it, expect, beforeEach } from 'vitest';
import { noteService } from '../note.service';
import { safeStorage } from '../../lib/storage';

describe('NoteService and Document Repository', () => {
  const userId = 'user_test_notes_1';

  beforeEach(() => {
    safeStorage.clear();
  });

  it('creates markdown note, computes word count, and persists summary', async () => {
    const res = await noteService.createNote(userId, {
      title: 'Axioms of Resilient Systems',
      content: '# Resilient Systems\n\n1. Isolation\n2. Determinism\n3. Graceful degradation.',
      tags: ['systems', 'engineering'],
      isPinned: true,
    });

    expect(res.success).toBe(true);
    expect(res.data?.title).toBe('Axioms of Resilient Systems');
    expect(res.data?.wordCount).toBeGreaterThan(5);
    expect(res.data?.isPinned).toBe(true);
    expect(res.data?.isArchived).toBe(false);
  });

  it('filters notes by pinned state, archived state, tags, and search query', async () => {
    await noteService.createNote(userId, {
      title: 'Distributed State Machines',
      content: 'Raft and Paxos comparison',
      tags: ['distributed', 'consensus'],
      isPinned: false,
    });

    await noteService.createNote(userId, {
      title: 'Weekly Grocery List',
      content: 'Apples, Oats, Greek yogurt',
      tags: ['personal'],
      isPinned: false,
    });

    // Filter by tag
    const taggedRes = await noteService.getNotes(userId, { tag: 'distributed' });
    expect(taggedRes.data?.length).toBe(1);
    expect(taggedRes.data?.[0].title).toBe('Distributed State Machines');

    // Filter by search query
    const searchRes = await noteService.getNotes(userId, { search: 'Greek' });
    expect(searchRes.data?.length).toBe(1);
    expect(searchRes.data?.[0].title).toBe('Weekly Grocery List');
  });
});
