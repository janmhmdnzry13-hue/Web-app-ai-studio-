import React from 'react';
import { ErrorState } from '../components/ui/ErrorState';

export function GenericErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
      <div className="max-w-md w-full">
        <ErrorState
          title="500 — System Fault"
          message="An unhandled system error occurred. The application state can be safely re-initialized."
          code="HTTP_500_INTERNAL_FAULT"
          onRetry={() => window.location.reload()}
          onReset={() => {
            window.location.href = '/app';
          }}
        />
      </div>
    </div>
  );
}
