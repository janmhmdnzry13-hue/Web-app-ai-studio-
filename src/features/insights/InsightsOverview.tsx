import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { insightService } from '../../services/insight.service';
import { LifeInsight, SystemDataSummary } from '../../types/insight.types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency } from '../../lib/utils';
import {
  Compass,
  Sparkles,
  TrendingUp,
  Target,
  CheckCircle2,
  Repeat,
  Wallet,
  Smile,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Info,
  Layers,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function InsightsOverview() {
  const { user } = useAuth();
  const { error } = useToast();

  const [summary, setSummary] = useState<SystemDataSummary | null>(null);
  const [insights, setInsights] = useState<LifeInsight[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [sumRes, insRes] = await Promise.all([
        insightService.getSystemSummary(user.id),
        insightService.generateLifeInsights(user.id),
      ]);

      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }
      if (insRes.success && insRes.data) {
        setInsights([...insRes.data]);
      }
    } catch {
      error('Error', 'Failed to generate cross-system insights.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Page Header */}
      <PageHeader
        title="Life Insights & Intelligence"
        description="Cross-system behavioral synthesis distinguishing verified empirical data from behavioral interpretation."
        badge={{ label: 'Empirical Grounding', variant: 'primary' }}
        breadcrumbs={[{ label: 'ORIGIN' }, { label: 'Life Insights' }]}
        actions={
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={loadData}
          >
            Refresh Synthesis
          </Button>
        }
      />

      {/* Epistemological Distinction & Non-Diagnostic Notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 text-xs">
        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-neutral-900 dark:text-neutral-100">
            Empirical Rigor & Epistemological Transparency
          </p>
          <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
            ORIGIN strictly separates <strong>Observed Data</strong> (unambiguous, calculated telemetry directly recorded in tasks, finances, habits, and reflections) from <strong>Interpretation</strong> (descriptive behavioral analysis). No insights are invented when data volume is insufficient.
          </p>
        </div>
      </div>

      {/* System Telemetry Pulse Matrix */}
      {summary && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Cross-Domain System Telemetry
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-neutral-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Tasks Done</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {summary.totalTasksCompleted}
              </p>
              <p className="text-[10px] text-neutral-500">{summary.pendingTasksCount} pending</p>
            </Card>

            <Card className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-neutral-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Goal Progress</span>
                <Target className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {summary.averageGoalProgress}%
              </p>
              <p className="text-[10px] text-neutral-500">{summary.activeGoalsCount} active horizons</p>
            </Card>

            <Card className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-neutral-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Habit Index</span>
                <Repeat className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {summary.habitConsistencyRate}%
              </p>
              <p className="text-[10px] text-neutral-500">{summary.activeHabitsCount} active habits</p>
            </Card>

            <Card className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-neutral-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Net Cashflow</span>
                <Wallet className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <p
                className={`text-xl font-bold ${
                  summary.netCashflow >= 0 ? 'text-neutral-900 dark:text-neutral-100' : 'text-rose-500'
                }`}
              >
                {formatCurrency(summary.netCashflow)}
              </p>
              <p className="text-[10px] text-neutral-500">
                {summary.monthlyIncomeTotal > 0 ? `${Math.round((summary.netCashflow / summary.monthlyIncomeTotal) * 100)}% savings` : 'Inflow balance'}
              </p>
            </Card>

            <Card className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-neutral-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Mean Energy</span>
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {summary.averageEnergy ? `${summary.averageEnergy} / 5` : '—'}
              </p>
              <p className="text-[10px] text-neutral-500">{summary.reflectionsCount} reflections</p>
            </Card>

            <Card className="p-3.5 space-y-1">
              <div className="flex items-center justify-between text-neutral-500">
                <span className="text-[10px] font-bold uppercase tracking-wider">Relationships</span>
                <Compass className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {summary.relationshipsTracked}
              </p>
              <p className="text-[10px] text-neutral-500">Active circles</p>
            </Card>
          </div>
        </div>
      )}

      {/* Generated Insights Grid (Observed vs Interpretation) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Synthesized Empirical Insights
          </h3>
          <span className="text-xs text-neutral-500">
            {insights.length} verified observations
          </span>
        </div>

        {insights.length === 0 ? (
          <Card className="p-12 text-center text-xs text-neutral-400 space-y-3">
            <Compass className="h-8 w-8 mx-auto text-neutral-300 dark:text-neutral-700" />
            <p className="font-semibold text-neutral-700 dark:text-neutral-300">
              Insufficient Baseline Telemetry
            </p>
            <p className="max-w-md mx-auto">
              ORIGIN does not generate speculative insights without underlying data. Continue recording tasks, habits, reflections, and finances to unlock pattern intelligence.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {insights.map((ins) => (
              <Card key={ins.id} className="p-6 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Insight Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        {ins.domain.replace('_', ' ')}
                      </span>
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                        {ins.title}
                      </h4>
                    </div>
                    <Badge
                      variant={
                        ins.type === 'positive_trend'
                          ? 'success'
                          : ins.type === 'growth_opportunity'
                          ? 'warning'
                          : 'primary'
                      }
                      size="sm"
                    >
                      {ins.type.replace('_', ' ')}
                    </Badge>
                  </div>

                  {/* Section A: Observed Data (Empirical Metrics) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>Observed Data</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {ins.observedData.map((obs, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-neutral-800"
                        >
                          <p className="text-[10px] text-neutral-500 font-medium">{obs.label}</p>
                          <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                            {obs.value}
                          </p>
                          {obs.context && (
                            <p className="text-[10px] text-neutral-400 mt-0.5">{obs.context}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section B: Behavioral Interpretation */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span>Interpretation</span>
                    </div>
                    <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed bg-blue-50/40 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/40">
                      {ins.interpretation}
                    </p>
                  </div>
                </div>

                {/* Section C: Optional Actionable Step */}
                {ins.actionableStep && (
                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-start gap-2 text-xs">
                    <ArrowRight className="h-3.5 w-3.5 text-neutral-400 shrink-0 mt-0.5" />
                    <span className="text-neutral-600 dark:text-neutral-400 font-medium">
                      <strong>Recommended Focus:</strong> {ins.actionableStep}
                    </span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
