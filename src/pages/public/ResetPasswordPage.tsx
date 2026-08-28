import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Lock, CheckCircle2, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('resetToken') || '';
  const navigate = useNavigate();
  const { confirmPasswordReset } = useAuth();
  const { success, error } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!token.trim()) {
      newErrors.token = 'Reset token is missing from the URL. Please use the link sent to your email.';
    }
    if (!password) {
      newErrors.password = 'New password is required.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const res = await confirmPasswordReset({
        token: token.trim(),
        newPassword: password,
      });

      if (res.success) {
        setIsSuccess(true);
        success('Password Updated', 'Your password has been successfully reset. You can now sign in.');
      } else {
        error('Reset Failed', res.error || 'The reset link has expired or is invalid.');
        setErrors({ general: res.error || 'The reset link has expired or is invalid. Please request a new one.' });
      }
    } finally {
      setIsLoading(false);
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
            {isSuccess ? 'Password Updated' : 'Create New Password'}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {isSuccess
              ? 'Your password has been changed securely.'
              : 'Choose a strong password to protect your ORIGIN workspace.'}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {isSuccess ? (
              <div className="text-center space-y-4 py-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Security Credentials Reset
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Your password has been updated and the single-use reset token has been invalidated.
                  </p>
                </div>
                <Button className="w-full mt-4" onClick={() => navigate('/login', { replace: true })}>
                  Sign In with New Password
                </Button>
              </div>
            ) : !token ? (
              <div className="text-center space-y-4 py-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Invalid or Missing Reset Link
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    This password reset link is missing a valid security token. Please request a new password reset link from the sign-in page.
                  </p>
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/login')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errors.general && (
                  <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errors.general}</span>
                  </div>
                )}

                <Input
                  label="New Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  hint="Minimum 6 characters"
                  leftIcon={<Lock className="h-4 w-4" />}
                  required
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={errors.confirmPassword}
                  leftIcon={<Lock className="h-4 w-4" />}
                  required
                />

                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Update Password
                </Button>

                <div className="pt-2 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
