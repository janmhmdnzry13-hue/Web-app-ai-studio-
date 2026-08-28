import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { validateSchema, Validators } from '../../lib/validation';
import { ArrowRight, Lock, Mail, Sparkles, CheckCircle2 } from 'lucide-react';

export function LoginPage() {
  const { login, loginAsDemo, requestPasswordReset, isLoading } = useAuth();
  const { success, error, info } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Password Reset Dialog State
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'sent'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // If a reset token is passed via query string to /login, redirect cleanly to /reset-password
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token') || params.get('resetToken');
    if (token) {
      navigate(`/reset-password?token=${encodeURIComponent(token)}`, { replace: true });
    }
  }, [location.search, navigate]);

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
      if (res.success) {
        setResetStep('sent');
        info('Instructions Sent', res.data?.message || 'If an account exists, password reset instructions have been issued.');
      } else {
        error('Reset Error', res.error || 'Failed to request password reset.');
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
        title="Reset Your Password"
        description={
          resetStep === 'request'
            ? 'Enter your registered email address to receive password reset instructions.'
            : 'Check your email for instructions to reset your password.'
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
                Send Reset Link
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Password Reset Instructions Dispatched
                </p>
                <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  If an account exists with this email address, we have dispatched a single-use recovery link valid for 1 hour. Please check your inbox and click the link to set your new password.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button
                type="button"
                onClick={() => {
                  setIsResetOpen(false);
                  setResetStep('request');
                }}
              >
                Back to Sign In
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
