import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SYSTEM_MODULES } from '../../config/constants';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  Sparkles,
  CheckCircle2,
  Terminal,
  Compass,
  Cpu,
  LayoutDashboard,
  CheckSquare,
  Target,
  Repeat,
  Wallet,
  HeartHandshake,
  Users,
  FileText,
  Code2,
  Settings,
} from 'lucide-react';

export function LandingPage() {
  const { loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const iconMap: Record<string, React.ReactNode> = {
    LayoutDashboard: <LayoutDashboard className="h-4 w-4" />,
    CheckSquare: <CheckSquare className="h-4 w-4" />,
    Target: <Target className="h-4 w-4" />,
    Repeat: <Repeat className="h-4 w-4" />,
    Wallet: <Wallet className="h-4 w-4" />,
    HeartHandshake: <HeartHandshake className="h-4 w-4" />,
    Users: <Users className="h-4 w-4" />,
    FileText: <FileText className="h-4 w-4" />,
    Sparkles: <Sparkles className="h-4 w-4" />,
    Compass: <Compass className="h-4 w-4" />,
    Code2: <Code2 className="h-4 w-4" />,
    Settings: <Settings className="h-4 w-4" />,
  };

  const handleLaunchDemo = async () => {
    await loginAsDemo();
    navigate('/app');
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-20 py-12 sm:py-20 px-6 sm:px-12 max-w-6xl mx-auto w-full">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-900/80 px-3.5 py-1 text-xs font-medium text-neutral-800 dark:text-neutral-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Phase 1 Architecture Foundation Live</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50 leading-[1.1]">
          The Intelligent Operating System for Human Life.
        </h1>

        <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          ORIGIN integrates tasks, goals, habits, finances, emotional balance, relationships, and knowledge into a unified, high-leverage personal OS.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Button
            size="lg"
            onClick={handleLaunchDemo}
            rightIcon={<ArrowRight className="h-4 w-4" />}
            className="shadow-md"
          >
            Launch Foundation Workspace
          </Button>

          <Link to="/login">
            <Button size="lg" variant="outline">
              Sign In to Session
            </Button>
          </Link>
        </div>
      </section>

      {/* Architectural Tenets */}
      <section className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-3 shadow-xs">
          <div className="h-10 w-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-900 dark:text-neutral-100">
            <Layers className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Clean Domain Contracts
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Strict TypeScript contracts for all 10 life domains provide rock-solid boundaries between UI, services, and future persistence layers.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-3 shadow-xs">
          <div className="h-10 w-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-900 dark:text-neutral-100">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Isolated Security Architecture
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            User-scoped entity contracts prevent data crosstalk. Zero client secrets and sanitized logging safeguard operator privacy.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-3 shadow-xs">
          <div className="h-10 w-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-900 dark:text-neutral-100">
            <Cpu className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Predictable Service Layer
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Decoupled service abstractions with typed ServiceResult and error structures enable future backend streaming without UI rewrites.
          </p>
        </div>
      </section>

      {/* Module Matrix Overview */}
      <section className="w-full space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Planned System Architecture Modules
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Phase 1 establishes the structural foundation and schemas; Phase 2 powers the active data pipelines.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {SYSTEM_MODULES.map((mod) => (
            <div
              key={mod.id}
              className="rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/70 p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="h-7 w-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
                  {iconMap[mod.iconName]}
                </div>
                <Badge variant={mod.phase === 1 ? 'success' : 'subtle'} size="sm">
                  {mod.phase === 1 ? 'Foundation' : 'Phase 2'}
                </Badge>
              </div>
              <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{mod.name}</h4>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                {mod.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
