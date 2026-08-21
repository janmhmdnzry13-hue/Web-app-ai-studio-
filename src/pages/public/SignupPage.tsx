import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { validateSchema, Validators } from '../../lib/validation';
import { Mail, Lock, User } from 'lucide-react';

export function SignupPage() {
  const { signup, isLoading } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateSchema(
      { displayName, email, password },
      {
        displayName: [Validators.required('Display name is required'), Validators.minLength(2)],
        email: [Validators.required('Email is required'), Validators.email()],
        password: [Validators.required('Password is required'), Validators.minLength(6)],
      }
    );

    if (!validation.isValid) {
      setErrors(validation.errors as Record<string, string>);
      return;
    }

    setErrors({});
    const res = await signup({ displayName, email, password });
    if (res.success) {
      success('Account Created', `Welcome to ORIGIN, ${displayName}`);
      navigate('/app', { replace: true });
    } else {
      error('Registration Error', res.error);
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
            Create your ORIGIN workspace
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Initialize your personal life operating system account.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name / Operator Handle"
                placeholder="Alex Vance"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                error={errors.displayName}
                leftIcon={<User className="h-4 w-4" />}
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                leftIcon={<Mail className="h-4 w-4" />}
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                leftIcon={<Lock className="h-4 w-4" />}
                hint="Minimum 6 characters for session encryption"
              />

              <Button type="submit" className="w-full" isLoading={isLoading}>
                Initialize Account
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-neutral-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-neutral-900 dark:text-neutral-100 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
