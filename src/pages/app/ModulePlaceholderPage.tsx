import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SYSTEM_MODULES } from '../../config/constants';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Code2, ArrowLeft, Layers, ShieldCheck, Cpu } from 'lucide-react';

export function ModulePlaceholderPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const moduleInfo = SYSTEM_MODULES.find((m) => m.path === location.pathname) || {
    id: 'module',
    name: 'Module Staging',
    description: 'Domain module contracts and architecture initialized.',
    category: 'productivity',
    phase: 2,
    status: 'foundation_ready' as const,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <PageHeader
        title={`${moduleInfo.name} Module`}
        description={moduleInfo.description}
        badge={{ label: 'Phase 1 Foundation Ready', variant: 'success' }}
        breadcrumbs={[{ label: 'ORIGIN' }, { label: moduleInfo.name }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => navigate('/app')}
            >
              Back to Overview
            </Button>
            <Button
              size="sm"
              leftIcon={<Code2 className="h-4 w-4" />}
              onClick={() => navigate('/app/architecture')}
            >
              View Domain Schemas
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center space-y-4 shadow-xs">
        <div className="mx-auto h-12 w-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
          <Layers className="h-6 w-6" />
        </div>

        <div className="space-y-1 max-w-lg mx-auto">
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            {moduleInfo.name} Architecture Initialized
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            In accordance with Phase 1 directives, all domain type definitions, data contracts, and service abstractions for {moduleInfo.name} are implemented. Full data persistence and interactive widget management are scheduled for Phase 2.
          </p>
        </div>

        <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
          <Button size="sm" onClick={() => navigate('/app/architecture')}>
            Inspect {moduleInfo.name} Contract
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate('/app')}>
            Return to Dashboard
          </Button>
        </div>
      </div>

      {/* Contract & Boundary Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="subtle">
          <CardHeader>
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 mb-1">
              <Code2 className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-xs">Contract Typed</CardTitle>
            </div>
            <CardDescription className="text-xs leading-relaxed">
              `src/types/{moduleInfo.id}.types.ts` contains all domain entity schemas and DTOs.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card variant="subtle">
          <CardHeader>
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 mb-1">
              <Cpu className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-xs">Service Layer Ready</CardTitle>
            </div>
            <CardDescription className="text-xs leading-relaxed">
              `I{moduleInfo.name}Service` interface and provider in `src/services/{moduleInfo.id}.service.ts`.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card variant="subtle">
          <CardHeader>
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 mb-1">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-xs">User Scoped</CardTitle>
            </div>
            <CardDescription className="text-xs leading-relaxed">
              All domain records extend `UserScopedEntity` for tenant privacy and security.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
