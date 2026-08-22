import React, { useState } from 'react';
import { AIProposedAction } from '../../types/ai.types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { aiService } from '../../services/ai.service';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  CheckSquare,
  Target,
  Repeat,
  FileText,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface ActionConfirmationCardProps {
  action: AIProposedAction;
  onActionApplied?: (actionId: string, resultSummary: string) => void;
  onActionDismissed?: (actionId: string) => void;
}

export function ActionConfirmationCard({
  action,
  onActionApplied,
  onActionDismissed,
}: ActionConfirmationCardProps) {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [status, setStatus] = useState<'pending' | 'applied' | 'rejected'>(action.status || 'pending');
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [resultSummary, setResultSummary] = useState<string>('');

  const getActionIcon = () => {
    switch (action.type) {
      case 'create_task':
      case 'update_task_status':
        return <CheckSquare className="h-4 w-4 text-blue-500" />;
      case 'create_goal':
        return <Target className="h-4 w-4 text-purple-500" />;
      case 'log_habit':
        return <Repeat className="h-4 w-4 text-emerald-500" />;
      case 'create_note':
        return <FileText className="h-4 w-4 text-teal-500" />;
      case 'create_transaction':
        return <Wallet className="h-4 w-4 text-indigo-500" />;
      default:
        return <CheckSquare className="h-4 w-4 text-neutral-500" />;
    }
  };

  const getActionBadge = () => {
    switch (action.type) {
      case 'create_task':
        return <Badge variant="primary" size="sm">Task Creation</Badge>;
      case 'create_goal':
        return <Badge variant="warning" size="sm">Goal Horizon</Badge>;
      case 'log_habit':
        return <Badge variant="success" size="sm">Habit Log</Badge>;
      case 'create_note':
        return <Badge variant="subtle" size="sm">Note Capture</Badge>;
      case 'create_transaction':
        return <Badge variant="danger" size="sm">Financial Entry</Badge>;
      case 'update_task_status':
        return <Badge variant="primary" size="sm">Task Update</Badge>;
      default:
        return <Badge variant="subtle" size="sm">Action</Badge>;
    }
  };

  const handleApply = async () => {
    if (!user?.id) return;
    setIsApplying(true);
    try {
      const res = await aiService.executeAction(user.id, action);
      if (res.success && res.data) {
        setStatus('applied');
        setResultSummary(res.data.summary);
        success('Action Executed', res.data.summary);
        onActionApplied?.(action.id, res.data.summary);
      } else {
        error('Execution Error', res.error?.message || 'Failed to apply proposed action');
      }
    } catch (err: any) {
      error('Execution Error', err.message || 'Failed to execute mutation');
    } finally {
      setIsApplying(false);
    }
  };

  const handleDismiss = () => {
    setStatus('rejected');
    onActionDismissed?.(action.id);
  };

  return (
    <div
      className={`rounded-xl border p-3.5 space-y-3 transition-all ${
        status === 'applied'
          ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20'
          : status === 'rejected'
          ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 opacity-60'
          : 'border-neutral-200/90 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            {getActionIcon()}
          </div>
          <div>
            <h5 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
              {action.title}
            </h5>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {action.description}
            </p>
          </div>
        </div>
        <div>{getActionBadge()}</div>
      </div>

      {/* Payload attributes preview */}
      {action.payload && Object.keys(action.payload).length > 0 && (
        <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/50 dark:border-neutral-700/40 text-[11px] space-y-1">
          {action.payload.title && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Title:</span>
              <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">
                {action.payload.title}
              </span>
            </div>
          )}
          {action.payload.priority && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Priority:</span>
              <span className="capitalize font-semibold text-neutral-800 dark:text-neutral-200">
                {action.payload.priority}
              </span>
            </div>
          )}
          {action.payload.estimatedMinutes && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Estimate:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                {action.payload.estimatedMinutes} mins
              </span>
            </div>
          )}
          {action.payload.amount && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Amount:</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">
                ${Number(action.payload.amount).toLocaleString()}
              </span>
            </div>
          )}
          {action.payload.horizon && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Horizon:</span>
              <span className="capitalize font-medium text-neutral-800 dark:text-neutral-200">
                {String(action.payload.horizon).replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <div className="flex items-center gap-1 text-[11px] text-neutral-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Requires your explicit confirmation</span>
        </div>

        {status === 'pending' && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-2 text-neutral-500"
              onClick={handleDismiss}
              disabled={isApplying}
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              className="text-xs h-7 px-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
              onClick={handleApply}
              isLoading={isApplying}
            >
              Confirm & Apply
            </Button>
          </div>
        )}

        {status === 'applied' && (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
            <CheckCircle2 className="h-4 w-4" />
            <span>Applied: {resultSummary || 'Mutation executed'}</span>
          </div>
        )}

        {status === 'rejected' && (
          <div className="flex items-center gap-1 text-neutral-400 text-xs">
            <XCircle className="h-4 w-4" />
            <span>Dismissed</span>
          </div>
        )}
      </div>
    </div>
  );
}
