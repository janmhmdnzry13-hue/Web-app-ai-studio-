import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { goalService } from '../../services/goal.service';
import {
  Goal,
  GoalCategory,
  GoalTimeframe,
  Milestone,
  CreateGoalDTO,
} from '../../types/goal.types';
import { LifecycleStatus } from '../../types/common.types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  Target,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  Calendar,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Milestone as MilestoneIcon,
  Compass,
} from 'lucide-react';

export function GoalsView() {
  const { user } = useAuth();
  const { success, error, info } = useToast();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<GoalCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<LifecycleStatus | 'all'>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<GoalTimeframe | 'all'>('all');

  // Expanded milestones state
  const [expandedGoalIds, setExpandedGoalIds] = useState<Record<string, boolean>>({});

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  // Milestone creation modal
  const [activeGoalForMilestone, setActiveGoalForMilestone] = useState<Goal | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneTargetDate, setMilestoneTargetDate] = useState('');
  const [milestoneWeight, setMilestoneWeight] = useState('20');

  // Goal Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<GoalCategory>('career_craft');
  const [formTimeframe, setFormTimeframe] = useState<GoalTimeframe>('quarterly');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formInitialMilestones, setFormInitialMilestones] = useState<{ title: string; weight: number }[]>([]);
  const [newInitMilestoneTitle, setNewInitMilestoneTitle] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load Goals
  const loadGoals = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const res = await goalService.getGoals(user.id);
      if (res.success && res.data) {
        let filtered = [...res.data];
        if (categoryFilter !== 'all') {
          filtered = filtered.filter((g) => g.category === categoryFilter);
        }
        if (statusFilter !== 'all') {
          filtered = filtered.filter((g) => g.status === statusFilter);
        }
        if (timeframeFilter !== 'all') {
          filtered = filtered.filter((g) => g.timeframe === timeframeFilter);
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (g) =>
              g.title.toLowerCase().includes(q) ||
              g.description?.toLowerCase().includes(q) ||
              g.milestones.some((m) => m.title.toLowerCase().includes(q))
          );
        }
        setGoals(filtered);
      }
    } catch {
      error('Load Error', 'Failed to retrieve strategic goals');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, categoryFilter, statusFilter, timeframeFilter, searchQuery, error]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // Goal Statistics
  const stats = useMemo(() => {
    const total = goals.length;
    const active = goals.filter((g) => g.status === 'active').length;
    const completed = goals.filter((g) => g.status === 'completed').length;
    const avgProgress =
      total > 0 ? Math.round(goals.reduce((acc, g) => acc + g.progressPercentage, 0) / total) : 0;

    return { total, active, completed, avgProgress };
  }, [goals]);

  // Open Create Goal Modal
  const handleOpenCreateModal = () => {
    setEditingGoal(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('career_craft');
    setFormTimeframe('quarterly');
    setFormTargetDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setFormInitialMilestones([]);
    setNewInitMilestoneTitle('');
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Open Edit Goal Modal
  const handleOpenEditModal = (goal: Goal) => {
    setEditingGoal(goal);
    setFormTitle(goal.title);
    setFormDescription(goal.description || '');
    setFormCategory(goal.category);
    setFormTimeframe(goal.timeframe);
    setFormTargetDate(goal.targetDate ? goal.targetDate.split('T')[0] : '');
    setFormInitialMilestones([]);
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  // Save Goal
  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormErrors({ title: 'Goal title is required.' });
      return;
    }
    if (!user?.id) return;

    try {
      if (editingGoal) {
        const updatePayload: Partial<Goal> = {
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
          timeframe: formTimeframe,
          targetDate: formTargetDate ? new Date(`${formTargetDate}T23:59:59.000Z`).toISOString() : editingGoal.targetDate,
        };

        const res = await goalService.updateGoal(user.id, editingGoal.id, updatePayload);
        if (res.success && res.data) {
          success('Goal Updated', `"${res.data.title}" updated.`);
          setIsCreateModalOpen(false);
          loadGoals();
        } else {
          error('Update Failed', res.error?.message || 'Unable to update goal');
        }
      } else {
        const targetDateIso = formTargetDate
          ? new Date(`${formTargetDate}T23:59:59.000Z`).toISOString()
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

        const createDTO: CreateGoalDTO = {
          title: formTitle.trim(),
          description: formDescription.trim(),
          category: formCategory,
          timeframe: formTimeframe,
          targetDate: targetDateIso,
          milestones: formInitialMilestones.map((m) => ({
            title: m.title,
            weight: m.weight,
          })),
        };

        const res = await goalService.createGoal(user.id, createDTO);
        if (res.success && res.data) {
          success('Goal Established', `"${res.data.title}" added to life horizons.`);
          setIsCreateModalOpen(false);
          loadGoals();
        } else {
          error('Creation Failed', res.error?.message || 'Unable to create goal');
        }
      }
    } catch {
      error('Error', 'An unexpected error occurred saving goal.');
    }
  };

  // Toggle Milestone Completion
  const handleToggleMilestone = async (goalId: string, milestoneId: string) => {
    if (!user?.id) return;
    const res = await goalService.toggleMilestone(user.id, goalId, milestoneId);
    if (res.success && res.data) {
      setGoals((prev) => prev.map((g) => (g.id === goalId ? res.data! : g)));
      success('Progress Recalculated', `Goal progress is now ${res.data.progressPercentage}%.`);
    }
  };

  // Add Milestone to Existing Goal
  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !activeGoalForMilestone) return;
    if (!milestoneTitle.trim()) {
      error('Validation', 'Milestone title is required.');
      return;
    }

    const weightNum = parseFloat(milestoneWeight) || 20;
    const milestoneDTO: Omit<Milestone, 'id' | 'isCompleted'> = {
      title: milestoneTitle.trim(),
      targetDate: milestoneTargetDate ? new Date(`${milestoneTargetDate}T23:59:59.000Z`).toISOString() : undefined,
      weight: weightNum,
    };

    const res = await goalService.addMilestone(user.id, activeGoalForMilestone.id, milestoneDTO);
    if (res.success && res.data) {
      setGoals((prev) => prev.map((g) => (g.id === activeGoalForMilestone.id ? res.data! : g)));
      success('Milestone Added', `Milestone added to "${activeGoalForMilestone.title}".`);
      setActiveGoalForMilestone(null);
      setMilestoneTitle('');
      setMilestoneTargetDate('');
      setMilestoneWeight('20');
    }
  };

  // Direct Progress Adjustment for Goals
  const handleDirectProgressChange = async (goal: Goal, newProgress: number) => {
    if (!user?.id) return;
    const res = await goalService.updateGoalProgress(user.id, goal.id, newProgress);
    if (res.success && res.data) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? res.data! : g)));
    }
  };

  // Delete Goal
  const handleDeleteGoal = async () => {
    if (!user?.id || !deletingGoalId) return;
    const res = await goalService.deleteGoal(user.id, deletingGoalId);
    if (res.success) {
      success('Goal Deleted', 'Strategic goal removed.');
      setDeletingGoalId(null);
      loadGoals();
    } else {
      error('Delete Failed', res.error?.message || 'Unable to delete goal');
    }
  };

  // Seed Starter Goals
  const handleSeedGoals = async () => {
    if (!user?.id) return;
    const res = await goalService.seedStarterGoals(user.id);
    if (res.success) {
      success('Starter Goals Seeded', 'Sample life horizon goals loaded.');
      loadGoals();
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedGoalIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getCategoryBadge = (category: GoalCategory) => {
    switch (category) {
      case 'career_craft':
        return <Badge variant="subtle" size="sm">Career & Craft</Badge>;
      case 'health_vitality':
        return <Badge variant="success" size="sm">Health & Vitality</Badge>;
      case 'financial_freedom':
        return <Badge variant="warning" size="sm">Financial Freedom</Badge>;
      case 'mind_learning':
        return <Badge variant="outline" size="sm">Mind & Learning</Badge>;
      case 'relationships_community':
        return <Badge variant="subtle" size="sm">Relationships</Badge>;
      case 'creative_expression':
        return <Badge variant="outline" size="sm">Creative Expression</Badge>;
      case 'environment_home':
        return <Badge variant="subtle" size="sm">Home & Space</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Page Header */}
      <PageHeader
        title="Life Horizons & Strategic Goals"
        description="Define long-term vision, quarterly outcomes, and weighted milestone progression."
        badge={{ label: `${stats.total} Goals`, variant: 'subtle' }}
        actions={
          <div className="flex items-center gap-2">
            {goals.length === 0 && (
              <Button variant="outline" size="sm" leftIcon={<Sparkles className="h-4 w-4" />} onClick={handleSeedGoals}>
                Seed Starter Goals
              </Button>
            )}
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={handleOpenCreateModal}>
              New Strategic Goal
            </Button>
          </div>
        }
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Active Goals</span>
            <Target className="h-4 w-4 text-neutral-900 dark:text-neutral-100" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.active}</p>
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
            <span className="text-xs font-medium uppercase tracking-wider">Avg Progress</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.avgProgress}%</p>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium uppercase tracking-wider">Life Domains</span>
            <Compass className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
            {new Set(goals.map((g) => g.category)).size} Active
          </p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search strategic goals, descriptions, or milestones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter goals by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as GoalCategory | 'all')}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 cursor-pointer"
            >
              <option value="all">All Domains</option>
              <option value="career_craft">Career & Craft</option>
              <option value="health_vitality">Health & Vitality</option>
              <option value="financial_freedom">Financial Freedom</option>
              <option value="mind_learning">Mind & Learning</option>
              <option value="relationships_community">Relationships</option>
              <option value="creative_expression">Creative Expression</option>
              <option value="environment_home">Home & Space</option>
            </select>

            <select
              aria-label="Filter goals by timeframe"
              value={timeframeFilter}
              onChange={(e) => setTimeframeFilter(e.target.value as GoalTimeframe | 'all')}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 cursor-pointer"
            >
              <option value="all">All Horizons</option>
              <option value="quarterly">Quarterly Horizon</option>
              <option value="annual">Annual Commitment</option>
              <option value="multi_year">Multi-Year Vision</option>
              <option value="lifetime">Lifetime North Star</option>
            </select>

            <select
              aria-label="Filter goals by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LifecycleStatus | 'all')}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Goal Cards List */}
      <div className="space-y-4">
        {goals.length === 0 && !isLoading ? (
          <EmptyState
            title="No strategic goals match your criteria"
            description="Establish your first horizon goal with milestones to direct intentional effort."
            actionLabel="Create First Goal"
            onAction={handleOpenCreateModal}
          />
        ) : (
          goals.map((goal) => {
            const isExpanded = !!expandedGoalIds[goal.id];
            const completedMilestones = goal.milestones.filter((m) => m.isCompleted).length;

            return (
              <Card
                key={goal.id}
                className="overflow-hidden hover:border-neutral-300 dark:hover:border-neutral-700 transition-all"
              >
                <div className="p-5 space-y-4">
                  {/* Goal Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                          {goal.title}
                        </h4>
                        {getCategoryBadge(goal.category)}
                        <Badge variant="outline" size="sm" className="capitalize">
                          {goal.timeframe.replace('_', ' ')}
                        </Badge>
                        {goal.status === 'completed' && (
                          <Badge variant="success" size="sm">
                            Achieved
                          </Badge>
                        )}
                      </div>

                      {goal.description && (
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-2xl">
                          {goal.description}
                        </p>
                      )}
                    </div>

                    {/* Goal Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveGoalForMilestone(goal);
                        }}
                        title="Add milestone"
                        aria-label="Add milestone"
                        className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs flex items-center gap-1 font-medium transition-colors cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Milestone</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(goal)}
                        title="Edit goal"
                        aria-label="Edit goal"
                        className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingGoalId(goal.id)}
                        title="Delete goal"
                        aria-label="Delete goal"
                        className="p-1.5 rounded-lg text-neutral-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Math */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Execution Progress</span>
                      </span>
                      <span className="font-bold font-mono text-neutral-900 dark:text-neutral-100">
                        {goal.progressPercentage}%
                      </span>
                    </div>

                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          goal.progressPercentage >= 100
                            ? 'bg-emerald-500'
                            : goal.progressPercentage > 50
                            ? 'bg-neutral-900 dark:bg-neutral-100'
                            : 'bg-neutral-600 dark:bg-neutral-400'
                        }`}
                        style={{ width: `${goal.progressPercentage}%` }}
                      />
                    </div>

                    {/* Direct slider if no milestones defined */}
                    {goal.milestones.length === 0 && (
                      <div className="pt-1 flex items-center gap-3">
                        <span className="text-[11px] text-neutral-400">Direct Progress Adjust:</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={goal.progressPercentage}
                          onChange={(e) => handleDirectProgressChange(goal, parseInt(e.target.value, 10))}
                          className="w-48 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
                        />
                      </div>
                    )}
                  </div>

                  {/* Goal Meta Row & Milestones Toggle */}
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/60 text-xs text-neutral-500">
                    <div className="flex items-center gap-4">
                      {goal.targetDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                          <span>Target: {goal.targetDate.split('T')[0]}</span>
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <MilestoneIcon className="h-3.5 w-3.5 text-neutral-400" />
                        <span>
                          {completedMilestones} of {goal.milestones.length} milestones complete
                        </span>
                      </span>
                    </div>

                    {goal.milestones.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(goal.id)}
                        className="flex items-center gap-1 text-neutral-700 dark:text-neutral-300 font-medium hover:underline cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide Milestones' : 'View Milestones'}</span>
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Milestones Detailed Matrix */}
                  {isExpanded && goal.milestones.length > 0 && (
                    <div className="pt-2 space-y-2 pl-4 border-l-2 border-neutral-200 dark:border-neutral-800 ml-1 animate-in fade-in duration-100">
                      {goal.milestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50/70 dark:bg-neutral-900/60 text-xs"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleMilestone(goal.id, milestone.id)}
                              aria-label={milestone.isCompleted ? 'Mark milestone incomplete' : 'Mark milestone complete'}
                              className="text-neutral-400 hover:text-emerald-600 transition-colors cursor-pointer shrink-0"
                            >
                              {milestone.isCompleted ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Circle className="h-4 w-4" />
                              )}
                            </button>

                            <span
                              className={`font-medium ${
                                milestone.isCompleted
                                  ? 'line-through text-neutral-400 dark:text-neutral-500'
                                  : 'text-neutral-800 dark:text-neutral-200'
                              }`}
                            >
                              {milestone.title}
                            </span>

                            {milestone.weight > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono">
                                {milestone.weight}% weight
                              </span>
                            )}
                          </div>

                          {milestone.targetDate && (
                            <span className="text-[11px] text-neutral-400 shrink-0">
                              {milestone.targetDate.split('T')[0]}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Create / Edit Goal Modal */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingGoal ? 'Edit Strategic Goal' : 'Establish Horizon Goal'}
        description={
          editingGoal
            ? 'Adjust timeline, description, and strategic domain.'
            : 'Formulate an intentional long-term outcome with weighted milestones.'
        }
      >
        <form onSubmit={handleSaveGoal} className="space-y-4 py-2">
          <Input
            label="Goal Objective Title"
            placeholder="e.g. Master High-Distributed Systems Architecture"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            error={formErrors.title}
            required
          />

          <Textarea
            label="Strategic Purpose & Narrative"
            placeholder="Why does achieving this outcome matter? What is the transformation?"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Life Domain</label>
              <select
                aria-label="Goal life domain"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as GoalCategory)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="career_craft">Career & Craft</option>
                <option value="health_vitality">Health & Vitality</option>
                <option value="financial_freedom">Financial Freedom</option>
                <option value="mind_learning">Mind & Learning</option>
                <option value="relationships_community">Relationships</option>
                <option value="creative_expression">Creative Expression</option>
                <option value="environment_home">Home & Space</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Time Horizon</label>
              <select
                aria-label="Goal time horizon"
                value={formTimeframe}
                onChange={(e) => setFormTimeframe(e.target.value as GoalTimeframe)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="quarterly">Quarterly Horizon</option>
                <option value="annual">Annual Commitment</option>
                <option value="multi_year">Multi-Year Vision</option>
                <option value="lifetime">Lifetime North Star</option>
              </select>
            </div>
          </div>

          <Input
            label="Target Completion Date"
            type="date"
            value={formTargetDate}
            onChange={(e) => setFormTargetDate(e.target.value)}
          />

          {/* Initial Milestones builder (Create mode only) */}
          {!editingGoal && (
            <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Initial Key Milestones (Optional)
              </label>

              {formInitialMilestones.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-neutral-50 dark:bg-neutral-900 text-xs">
                  <span>{m.title}</span>
                  <button
                    type="button"
                    onClick={() => setFormInitialMilestones((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-neutral-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Complete foundational blueprint"
                  value={newInitMilestoneTitle}
                  onChange={(e) => setNewInitMilestoneTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newInitMilestoneTitle.trim()) {
                        setFormInitialMilestones((prev) => [
                          ...prev,
                          { title: newInitMilestoneTitle.trim(), weight: 25 },
                        ]);
                        setNewInitMilestoneTitle('');
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (newInitMilestoneTitle.trim()) {
                      setFormInitialMilestones((prev) => [
                        ...prev,
                        { title: newInitMilestoneTitle.trim(), weight: 25 },
                      ]);
                      setNewInitMilestoneTitle('');
                    }
                  }}
                >
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
              {editingGoal ? 'Update Goal' : 'Establish Goal'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Milestone to Goal Modal */}
      <Dialog
        isOpen={!!activeGoalForMilestone}
        onClose={() => setActiveGoalForMilestone(null)}
        title="Add Milestone"
        description={`Add a measurable milestone checkpoint to "${activeGoalForMilestone?.title}".`}
      >
        <form onSubmit={handleAddMilestone} className="space-y-4 py-2">
          <Input
            label="Milestone Title"
            placeholder="e.g. Pass system certification exam"
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Target Date"
              type="date"
              value={milestoneTargetDate}
              onChange={(e) => setMilestoneTargetDate(e.target.value)}
            />

            <Input
              label="Weight (% contribution, e.g. 25)"
              type="number"
              min="1"
              max="100"
              value={milestoneWeight}
              onChange={(e) => setMilestoneWeight(e.target.value)}
              hint="Percentage weight toward 100% completion"
            />
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <Button type="button" variant="outline" onClick={() => setActiveGoalForMilestone(null)}>
              Cancel
            </Button>
            <Button type="submit">Add Milestone</Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={!!deletingGoalId}
        onClose={() => setDeletingGoalId(null)}
        title="Delete Strategic Goal"
        description="Are you sure you want to delete this goal and its associated milestones? This action cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingGoalId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteGoal}>
              Delete Goal
            </Button>
          </>
        }
      >
        <div className="py-2 text-xs text-neutral-500">
          This goal and its historical progress records will be removed.
        </div>
      </Dialog>
    </div>
  );
}
