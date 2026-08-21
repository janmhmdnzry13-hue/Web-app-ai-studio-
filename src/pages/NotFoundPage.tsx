import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Home, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-200/60 dark:bg-neutral-800 font-mono text-2xl font-bold">
          404
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight">Route Not Found</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            The requested path does not exist within the ORIGIN operating system directory.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
          <Link to="/app">
            <Button size="sm" leftIcon={<Home className="h-4 w-4" />}>
              Open Workspace
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
