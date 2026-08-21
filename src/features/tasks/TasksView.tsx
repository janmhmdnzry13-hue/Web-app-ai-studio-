import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { taskService } from '../../services/task.service';
import { Task, TaskStatus, Subtask, CreateTaskDTO, UpdateTaskDTO } from '../../types/task.types';
import { PriorityLevel } from '../../types/common.types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  CheckSquare,
  Plus,
  Search,
  ArrowUpDown,
  Calendar,
  Clock,
  Tag,
  CheckCircle2,
  Circle,
  AlertCircle,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ListTodo,
} from 'lucide-react';

export function TasksView() {
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Sorting State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | 'all'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'createdAt' | 'title'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Expanded subtasks drawer map
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  // Dialog State: Create / Edit
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Form inputs for Create / Edit
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<PriorityLevel>('medium');
  const [formDueDate, setFormDueDate] = useState('');
  const [formEstimatedMinutes, setFormEstimatedMinutes] = useState<string>('');
  const [formTags, setFormTags] = useState('');
  const [formSubtasks, setFormSubtasks] = useState<{ id: string; title: string }[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Inline new subtask for existing task
  const [inlineSubtaskInput, setInlineSubtaskInput] = useState<Record<string, string>>({});

  // Fetch tasks
  const loadTasks = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const res = await taskService.getTasks(user.id, {
        status: statusFilter,
        priority: priorityFilter,
        search: searchQuery,
        sortBy,
        sortDirection,
      });

      if (res.success && res.data) {
        setTasks([...res.data.items]);
      }
    } catch {
      error('Load Error', 'Failed to retrieve tasks');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, statusFilter, priorityFilter, searchQuery, sortBy, sortDirection, error]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Statistics
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const urgent = tasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed').length;

    const todayStr = new Date().toISOString().split('T')[0];
    const dueToday = tasks.filter((t) => t.dueDate?.startsWith(todayStr) && t.status !== 'completed').length;

    return { total, completed, inProgress, urgent, dueToday };
  }, [tasks]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormDueDate('');
    setFormEstimatedMinutes('');
    setFormTags('');
    setFormSubtasks([]);
    setNewSubtaskInput('');
    setFormErrors({});
    setEditingTask(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormPriority(task.priority);
    setFormDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    setFormEstimatedMinutes(task.estimatedMinutes ? String(task.estimatedMinutes) : '');
    setFormTags(task.tags.join(', '));
    setFormSubtasks(task.subtasks.map((s) => ({ id: s.id, title: s.title })));
    setNewSubtaskInput('');
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Add subtask in modal builder
  const handleAddModalSubtask = () => {
    if (!newSubtaskInput.trim()) return;
    setFormSubtasks((prev) => [...prev, { id: `st_${Date.now()}`, title: newSubtaskInput.trim() }]);
    setNewSubtaskInput('');
  };

  const handleRemoveModalSubtask = (id: string) => {
    setFormSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  // Save Task (Create or Edit)
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormErrors({ title: 'Task title is required.' });
      return;
    }
    if (!user?.id) return;

    const parsedMinutes = formEstimatedMinutes ? parseInt(formEstimatedMinutes, 10) : undefined;
    const tagList = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingTask) {
        const updatePayload: UpdateTaskDTO = {
          title: formTitle.trim(),
          description: formDescription.trim(),
          priority: formPriority,
          dueDate: formDueDate ? new Date(`${formDueDate}T23:59:59.000Z`).toISOString() : undefined,
          estimatedMinutes: parsedMinutes && !isNaN(parsedMinutes) ? parsedMinutes : undefined,
          tags: tagList,
        };

        const res = await taskService.updateTask(user.id, editingTask.id, updatePayload);
        if (res.success && res.data) {
          success('Task Updated', `"${res.data.title}" updated successfully.`);
          setIsCreateModalOpen(false);
          loadTasks();
        } else {
          error('Update Failed', res.error?.message || 'Unable to update task');
        }
      } else {
        const createPayload: CreateTaskDTO = {
          title: formTitle.trim(),
          description: formDescription.trim(),
          priority: formPriority,
          dueDate: formDueDate ? new Date(`${formDueDate}T23:59:59.000Z`).toISOString() : undefined,
          estimatedMinutes: parsedMinutes && !isNaN(parsedMinutes) ? parsedMinutes : undefined,
          tags: tagList,
        };

        const res = await taskService.createTask(user.id, createPayload);
        if (res.success && res.data) {
          if (formSubtasks.length > 0) {
            const subtaskObjects: Subtask[] = formSubtasks.map((st) => ({
              id: st.id,
              title: st.title,
              completed: false,
            }));
            await taskService.updateTask(user.id, res.data.id, { subtasks: subtaskObjects });
          }

          success('Task Created', `"${res.data.title}" added to your task index.`);
          setIsCreateModalOpen(false);
          loadTasks();
        } else {
          error('Creation Failed', res.error?.message || 'Unable to create task');
        }
      }
    } catch {
      error('Error', 'An unexpected error occurred saving task.');
    }
  };

  // Toggle completion status
  const handleToggleTaskStatus = async (task: Task) => {
    if (!user?.id) return;
    const nextStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed';
    const res = await taskService.updateTask(user.id, task.id, { status: nextStatus });
    if (res.success && res.data) {
      if (nextStatus === 'completed') {
        success('Task Completed', `"${task.title}" marked as complete.`);
      } else {
        info('Task Reopened', `"${task.title}" set to To Do.`);
      }
      loadTasks();
    }
  };

  // Toggle in-progress status
  const handleToggleInProgress = async (task: Task) => {
    if (!user?.id) return;
    const nextStatus: TaskStatus = task.status === 'in_progress' ? 'todo' : 'in_progress';
    const res = await taskService.updateTask(user.id, task.id, { status: nextStatus });
    if (res.success && res.data) {
      loadTasks();
    }
  };

  // Toggle Subtask
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    if (!user?.id) return;
    const res = await taskService.toggleSubtask(user.id, taskId, subtaskId);
    if (res.success && res.data) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? res.data! : t)));
    }
  };

  // Add Inline Subtask to existing task
  const handleAddInlineSubtask = async (task: Task) => {
    if (!user?.id) return;
    const input = inlineSubtaskInput[task.id]?.trim();
    if (!input) return;

    const newSub: Subtask = {
      id: `st_${Date.now()}`,
      title: input,
      completed: false,
    };

    const updatedSubtasks = [...task.subtasks, newSub];
    const res = await taskService.updateTask(user.id, task.id, { subtasks: updatedSubtasks });
    if (res.success && res.data) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? res.data! : t)));
      setInlineSubtaskInput((prev) => ({ ...prev, [task.id]: '' }));
    }
  };

  // Delete Task
  const handleDeleteTask = async () => {
    if (!user?.id || !deletingTaskId) return;
    const res = await taskService.deleteTask(user.id, deletingTaskId);
    if (res.success) {
      success('Task Deleted', 'Task removed from workspace.');
      setDeletingTaskId(null);
      loadTasks();
    } else {
      error('Delete Failed', res.error?.message || 'Unable to delete task');
    }
  };

  // Seed Starter Blueprint Tasks
  const handleSeedTasks = async () => {
    if (!user?.id) return;
    const res = await taskService.seedStarterTasks(user.id);
    if (res.success) {
      success('Starter Blueprint Seeded', 'Pre-configured architectural tasks loaded.');
      loadTasks();
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedTaskIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Priority styling helper
  const getPriorityBadge = (priority: PriorityLevel) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="danger" size="sm">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning" size="sm">High</Badge>;
      case 'medium':
        return <Badge variant="subtle" size="sm">Medium</Badge>;
      case 'low':
        return <Badge variant="outline" size="sm">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Page Header */}
      <PageHeader
        title="Tasks & Commitments"
        description="Unified task execution, priority sequencing, subtasks, and schedule alignment."
        badge={{ label: `${stats.total} Total`, variant: 'subtle' }}
        actions={
          <div className="flex items-center gap-2">
            {tasks.length === 0 && (
              <Button variant="outline" size="sm" leftIcon={<Sparkles className="h-4 w-4" />} onClick={handleSeedTasks}>
                Seed Starter Tasks
              </Button>
            )}
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={handleOpenCreateModal}>
              New Task
            </Button>
          </div>
        }
      />

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Due Today</span>
            <Calendar className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.dueToday}</p>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">In Progress</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.inProgress}</p>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.completed}</p>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Urgent Focus</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.urgent}</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search tasks, descriptions, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter tasks by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
            </select>

            <select
              aria-label="Filter tasks by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityLevel | 'all')}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              aria-label="Sort tasks by attribute"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority' | 'createdAt' | 'title')}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 cursor-pointer"
            >
              <option value="createdAt">Created Date</option>
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="title">Title</option>
            </select>

            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title={`Sort direction: ${sortDirection}`}
              aria-label={`Sort direction: ${sortDirection}`}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Task List */}
      <div className="space-y-3">
        {tasks.length === 0 && !isLoading ? (
          <EmptyState
            title="No tasks match your criteria"
            description="Create a new task to organize your commitments, or reset active filters."
            actionLabel="Create First Task"
            onAction={handleOpenCreateModal}
          />
        ) : (
          tasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isExpanded = !!expandedTaskIds[task.id];
            const completedSubtasksCount = task.subtasks.filter((s) => s.completed).length;

            return (
              <Card
                key={task.id}
                className={`transition-all ${
                  isCompleted
                    ? 'opacity-70 bg-neutral-50/50 dark:bg-neutral-900/30'
                    : 'hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Checkbox & Title Details */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleTaskStatus(task)}
                        aria-label={isCompleted ? 'Mark task incomplete' : 'Mark task complete'}
                        className="mt-0.5 shrink-0 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={`text-sm font-semibold text-neutral-900 dark:text-neutral-100 ${
                              isCompleted ? 'line-through text-neutral-400 dark:text-neutral-500' : ''
                            }`}
                          >
                            {task.title}
                          </h4>
                          {getPriorityBadge(task.priority)}
                          {task.status === 'in_progress' && (
                            <Badge variant="subtle" size="sm">
                              In Progress
                            </Badge>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-3 pt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-neutral-400" />
                              <span>{task.dueDate.split('T')[0]}</span>
                            </span>
                          )}

                          {task.estimatedMinutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-neutral-400" />
                              <span>{task.estimatedMinutes}m est</span>
                            </span>
                          )}

                          {task.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Tag className="h-3 w-3 text-neutral-400" />
                              <div className="flex gap-1">
                                {task.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-mono text-[10px]"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {task.subtasks.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(task.id)}
                              className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300 hover:underline cursor-pointer"
                            >
                              <ListTodo className="h-3 w-3" />
                              <span>
                                {completedSubtasksCount}/{task.subtasks.length} subtasks
                              </span>
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleInProgress(task)}
                        title={task.status === 'in_progress' ? 'Pause task' : 'Set in progress'}
                        aria-label={task.status === 'in_progress' ? 'Pause task' : 'Set in progress'}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <Clock className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(task)}
                        title="Edit task"
                        aria-label="Edit task"
                        className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingTaskId(task.id)}
                        title="Delete task"
                        aria-label="Delete task"
                        className="p-1.5 rounded-lg text-neutral-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subtask Drawer */}
                  {(isExpanded || task.subtasks.length > 0) && (
                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 space-y-2 pl-8">
                      {task.subtasks.map((subtask) => (
                        <div key={subtask.id} className="flex items-center gap-2.5 text-xs">
                          <input
                            type="checkbox"
                            checked={subtask.completed}
                            onChange={() => handleToggleSubtask(task.id, subtask.id)}
                            className="rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 focus:ring-neutral-900 cursor-pointer"
                          />
                          <span
                            className={
                              subtask.completed
                                ? 'line-through text-neutral-400 dark:text-neutral-500'
                                : 'text-neutral-700 dark:text-neutral-300'
                            }
                          >
                            {subtask.title}
                          </span>
                        </div>
                      ))}

                      {/* Inline subtask quick adder */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Add subtask..."
                          value={inlineSubtaskInput[task.id] || ''}
                          onChange={(e) =>
                            setInlineSubtaskInput((prev) => ({ ...prev, [task.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddInlineSubtask(task);
                            }
                          }}
                          className="flex-1 px-2.5 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2"
                          onClick={() => handleAddInlineSubtask(task)}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Create / Edit Task Modal Dialog */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'Create New Task'}
        description={
          editingTask
            ? 'Update the parameters and commitments for this task.'
            : 'Define a deliberate task commitment with priority and schedule.'
        }
      >
        <form onSubmit={handleSaveTask} className="space-y-4 py-2">
          <Input
            label="Task Title"
            placeholder="e.g. Conduct deep architecture review..."
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            error={formErrors.title}
            required
          />

          <Textarea
            label="Description & Context"
            placeholder="Key objectives, links, or deliverables..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Priority Level</label>
              <select
                aria-label="Task priority level"
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as PriorityLevel)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <Input
              label="Due Date"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Estimated Time (Minutes)"
              type="number"
              placeholder="45"
              value={formEstimatedMinutes}
              onChange={(e) => setFormEstimatedMinutes(e.target.value)}
            />

            <Input
              label="Tags (comma separated)"
              placeholder="Architecture, Health, Sprint"
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
            />
          </div>

          {/* Subtask builder in modal */}
          {!editingTask && (
            <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Subtasks / Checklist (Optional)
              </label>

              {formSubtasks.map((st) => (
                <div key={st.id} className="flex items-center justify-between gap-2 p-2 rounded bg-neutral-50 dark:bg-neutral-900 text-xs">
                  <span>{st.title}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveModalSubtask(st.id)}
                    className="text-neutral-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Verify unit test coverage"
                  value={newSubtaskInput}
                  onChange={(e) => setNewSubtaskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddModalSubtask();
                    }
                  }}
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddModalSubtask}>
                  Add
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingTask ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={!!deletingTaskId}
        onClose={() => setDeletingTaskId(null)}
        title="Delete Task"
        description="Are you sure you want to remove this task? This action cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingTaskId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteTask}>
              Delete Task
            </Button>
          </>
        }
      >
        <div className="py-2 text-xs text-neutral-500">
          This task will be removed from your personal dashboard and history.
        </div>
      </Dialog>
    </div>
  );
}
