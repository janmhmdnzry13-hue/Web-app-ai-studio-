import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { validateSchema, Validators } from '../../lib/validation';
import { ArrowRight, Lock, Mail, Sparkles, KeyRound } from 'lucide-react';

export function LoginPage() {
  const { login, loginAsDemo, requestPasswordReset, confirmPasswordReset, isLoading } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Password Reset Dialog State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [issuedTokenHint, setIssuedTokenHint] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const redirectPath = (location.state as { from?: { pathname: string } })?.from?.pathname || '/app';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateSchema(
      { email, password },
      {
        email: [Validators.required('Email is required'), Validators.email()],
        password: [Validators.required('Password is required'), Validators.minLength(6)],
      }
    );

    if (!validation.isValid) {
      setErrors(validation.errors as Record<string, string>);
      return;
    }

    setErrors({});
    const res = await login({ email, password });
    if (res.success) {
      success('Welcome back', `Authenticated as ${email}`);
      navigate(redirectPath, { replace: true });
    } else {
      error('Authentication Failed', res.error);
    }
  };

  const handleDemoLogin = async () => {
    await loginAsDemo();
    success('Demo Session Initialized', 'Logged in with Architect credentials.');
    navigate(redirectPath, { replace: true });
  };

  // Password reset request handler
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      error('Validation Error', 'Please enter your registered email address.');
      return;
    }
    setResetLoading(true);
    try {
      const res = await requestPasswordReset({ email: resetEmail.trim() });
      if (res.success && res.data) {
        setIssuedTokenHint(res.data.resetToken || null);
        setResetStep('confirm');
        if (res.data.resetToken) {
          setResetToken(res.data.resetToken);
        }
        info('Reset Token Generated', 'Enter your token and new password to complete reset.');
      } else {
        error('Reset Error', res.error || 'Failed to generate reset request.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  // Password reset confirmation handler
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken.trim() || !newPassword.trim()) {
      error('Validation Error', 'Reset token and new password are required.');
      return;
    }
    if (newPassword.length < 6) {
      error('Validation Error', 'New password must be at least 6 characters.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await confirmPasswordReset({ token: resetToken.trim(), newPassword: newPassword.trim() });
      if (res.success) {
        success('Password Reset', 'Your password has been updated. Please sign in.');
        setIsResetOpen(false);
        setResetStep('request');
        setPassword('');
      } else {
        error('Reset Failed', res.error || 'Invalid or expired reset token.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1.5">
          <div className="mx-auto h-10 w-10 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 flex items-center justify-center font-bold text-base font-mono mb-3 shadow-xs">
            O
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Sign in to ORIGIN
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Access your unified personal operating system workspace.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Quick Demo Session Action */}
            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Instant Demo Session
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Explore the Phase 2 core with pre-configured developer tasks, habits, and goals.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs"
                onClick={handleDemoLogin}
                isLoading={isLoading}
              >
                Launch Demo Session
              </Button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
              </div>
              <span className="relative bg-white dark:bg-neutral-900 px-2 text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
                Or continue with credentials
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                leftIcon={<Mail className="h-4 w-4" />}
              />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Password</span>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetStep('request');
                      setIsResetOpen(true);
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  leftIcon={<Lock className="h-4 w-4" />}
                />
              </div>

              <Button type="submit" className="w-full" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-neutral-500">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-semibold text-neutral-900 dark:text-neutral-100 underline">
            Create an account
          </Link>
        </p>
      </div>

      {/* Password Reset Modal */}
      <Dialog
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title="Password Reset Architecture"
        description={
          resetStep === 'request'
            ? 'Enter your registered email address to generate a secure recovery token.'
            : 'Enter your verification token and define your new secure password.'
        }
      >
        {resetStep === 'request' ? (
          <form onSubmit={handleRequestReset} className="space-y-4 py-2">
            <Input
              label="Account Email"
              type="email"
              placeholder="name@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              leftIcon={<Mail className="h-4 w-4" />}
            />

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button type="button" variant="outline" onClick={() => setIsResetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={resetLoading}>
                Generate Recovery Token
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleConfirmReset} className="space-y-4 py-2">
            {issuedTokenHint && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs space-y-1">
                <span className="font-semibold text-amber-800 dark:text-amber-200">Recovery Token Issued:</span>
                <p className="font-mono text-[11px] text-amber-700 dark:text-amber-300 select-all break-all">
                  {issuedTokenHint}
                </p>
              </div>
            )}

            <Input
              label="Reset Token"
              placeholder="rst_..."
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              required
              leftIcon={<KeyRound className="h-4 w-4" />}
            />

            <Input
              label="New Password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              hint="Minimum 6 characters"
              leftIcon={<Lock className="h-4 w-4" />}
            />

            <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button type="button" variant="outline" onClick={() => setResetStep('request')}>
                Back
              </Button>
              <Button type="submit" isLoading={resetLoading}>
                Confirm Password Reset
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
