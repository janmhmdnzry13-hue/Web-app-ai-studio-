import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Checkbox } from '../../components/ui/Checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { apiClient } from '../../lib/api-client';
import {
  Sun,
  Moon,
  Eye,
  Bell,
  User,
  Shield,
  Download,
  Globe,
  Trash2,
  AlertTriangle,
  Sparkles,
  Bot,
  CreditCard,
  CheckCircle2,
  Lock,
  Crown,
  History,
  ArrowUpRight,
} from 'lucide-react';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
];

export function SettingsView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateProfile, updateUserPreferences, exportUserData, deleteAccount } = useAuth();
  const { theme, setTheme } = useTheme();
  const { success, error, info } = useToast();

  const activeTabParam = searchParams.get('tab') || (searchParams.get('billing_status') ? 'billing' : 'profile');

  // Profile Form State
  const [displayName, setDisplayName] = useState(user?.profile?.displayName || 'Alex Vance');
  const [headline, setHeadline] = useState(user?.profile?.headline || 'Architect');
  const [bio, setBio] = useState(user?.profile?.bio || 'Designing intentional daily systems.');
  const [avatarUrl, setAvatarUrl] = useState(user?.profile?.avatarUrl || '');
  const [primaryLifeFocus, setPrimaryLifeFocus] = useState(user?.profile?.primaryLifeFocus || 'Deep Work & Daily Focus');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Timezone & Locale
  const [timezone, setTimezone] = useState(user?.preferences?.timezone || 'UTC');
  const [weekStartDay, setWeekStartDay] = useState<0 | 1 | 6>(user?.preferences?.weekStartDay ?? 1);

  // Accessibility state
  const [reducedMotion, setReducedMotion] = useState(user?.preferences?.reducedMotion ?? false);
  const [compactDensity, setCompactDensity] = useState(user?.preferences?.compactDensity ?? false);

  // Notification state
  const [inAppNotifs, setInAppNotifs] = useState(user?.preferences?.notificationChannels?.inApp ?? true);
  const [dailyDigest, setDailyDigest] = useState(user?.preferences?.notificationChannels?.dailyDigest ?? true);

  // Billing & Subscription state
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('annual');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [billingDetails, setBillingDetails] = useState<any>(null);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Account Deletion State
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Sync state when user changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.profile?.displayName || '');
      setHeadline(user.profile?.headline || '');
      setBio(user.profile?.bio || '');
      setAvatarUrl(user.profile?.avatarUrl || '');
      setPrimaryLifeFocus(user.profile?.primaryLifeFocus || '');
      setTimezone(user.preferences?.timezone || 'UTC');
      setWeekStartDay(user.preferences?.weekStartDay ?? 1);
      setReducedMotion(user.preferences?.reducedMotion ?? false);
      setCompactDensity(user.preferences?.compactDensity ?? false);
      setInAppNotifs(user.preferences?.notificationChannels?.inApp ?? true);
      setDailyDigest(user.preferences?.notificationChannels?.dailyDigest ?? true);
    }
  }, [user]);

  // Load Billing details
  useEffect(() => {
    async function loadBilling() {
      const res = await apiClient.get<any>('/api/billing/subscription');
      if (res.success && res.data) {
        setBillingDetails(res.data);
      }
    }
    loadBilling();
  }, []);

  // Handle return from Stripe checkout
  useEffect(() => {
    if (searchParams.get('billing_status') === 'success') {
      success('Welcome to ORIGIN Pro!', 'Your workspace has been upgraded with unlimited capacity and bank-grade encryption.');
    }
  }, [searchParams]);

  const loadAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await apiClient.get<any[]>('/api/audit/logs');
      if (res.success && Array.isArray(res.data)) {
        setAuditLogs(res.data);
      }
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      error('Validation Error', 'Display name cannot be empty.');
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await updateProfile({
        displayName: displayName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
        primaryLifeFocus: primaryLifeFocus.trim(),
      });

      if (res.success) {
        success('Profile Saved', 'Your personal profile details have been updated.');
      } else {
        error('Update Failed', res.error || 'Failed to update profile.');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      await updateUserPreferences({
        timezone,
        weekStartDay,
        reducedMotion,
        compactDensity,
        notificationChannels: {
          inApp: inAppNotifs,
          email: false,
          dailyDigest,
        },
      });
      success('Preferences Saved', 'Your settings have been saved.');
    } catch {
      error('Update Failed', 'Failed to update preferences.');
    }
  };

  const handleUpgradeToPro = async () => {
    setIsUpgrading(true);
    try {
      const res = await apiClient.post<any>('/api/billing/checkout', {
        interval: billingInterval,
      });

      if (res.success && res.data?.url) {
        if (res.data.mode === 'sandbox') {
          success('Pro Activated (Sandbox)', 'Your account is now upgraded to Pro.');
          // Refresh billing details
          const bRes = await apiClient.get<any>('/api/billing/subscription');
          if (bRes.success) setBillingDetails(bRes.data);
        } else {
          window.location.href = res.data.url;
        }
      } else {
        error('Upgrade Error', res.error?.message || 'Could not start checkout session.');
      }
    } catch (err: any) {
      error('Upgrade Error', err.message || 'Failed to process upgrade.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await exportUserData();
      if (!res.success || !res.data) {
        error('Export Failed', res.error || 'Failed to assemble export archive.');
        return;
      }

      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `origin_export_${user?.id || 'me'}_${dateStr}.json`;
      link.click();
      URL.revokeObjectURL(url);
      success('Data Export Ready', 'Your complete workspace backup has been downloaded.');
    } catch {
      error('Export Error', 'An unexpected error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      error('Confirmation Mismatch', 'Please type DELETE in all uppercase to confirm.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const res = await deleteAccount();
      if (res.success) {
        success('Account Deleted', 'Your account and data have been permanently removed.');
        navigate('/login');
      } else {
        error('Deletion Failed', res.error || 'Could not complete account deletion.');
      }
    } catch {
      error('Deletion Error', 'An error occurred during account deletion.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const isPro = billingDetails?.tier === 'pro' || (user as any)?.subscription?.tier === 'pro';

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <PageHeader
        title="Settings & Privacy"
        description="Manage your profile, theme, schedule, plan subscription, and private cloud data."
        breadcrumbs={[{ label: 'ORIGIN' }, { label: 'Settings' }]}
      />

      <Tabs defaultValue={activeTabParam}>
        <TabsList>
          <TabsTrigger value="profile" leftIcon={<User className="h-3.5 w-3.5" />}>
            Profile
          </TabsTrigger>
          <TabsTrigger value="billing" leftIcon={<CreditCard className="h-3.5 w-3.5" />}>
            Plan & Billing
          </TabsTrigger>
          <TabsTrigger value="appearance" leftIcon={<Sun className="h-3.5 w-3.5" />}>
            Appearance
          </TabsTrigger>
          <TabsTrigger value="localization" leftIcon={<Globe className="h-3.5 w-3.5" />}>
            Schedule & Time
          </TabsTrigger>
          <TabsTrigger value="accessibility" leftIcon={<Eye className="h-3.5 w-3.5" />}>
            Accessibility
          </TabsTrigger>
          <TabsTrigger value="notifications" leftIcon={<Bell className="h-3.5 w-3.5" />}>
            Notifications
          </TabsTrigger>
          <TabsTrigger value="data" leftIcon={<Shield className="h-3.5 w-3.5" />}>
            Privacy & Security
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>
                Customize how you appear in ORIGIN and set your core focus.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-5 max-w-xl">
                {/* Avatar */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Profile Photo
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 flex items-center justify-center font-bold text-lg overflow-hidden border-2 border-neutral-200 dark:border-neutral-800">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={displayName}
                          className="h-full w-full object-cover"
                          onError={() => setAvatarUrl('')}
                        />
                      ) : (
                        <span>{displayName ? displayName.slice(0, 2).toUpperCase() : 'ME'}</span>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <Input
                        placeholder="Avatar image URL (optional)"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        className="text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400">Presets:</span>
                        {AVATAR_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setAvatarUrl(preset)}
                            className="h-6 w-6 rounded-full overflow-hidden border border-neutral-300 dark:border-neutral-700 hover:scale-110 transition-transform cursor-pointer"
                          >
                            <img src={preset} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Display Name
                  </label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your Name"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Primary Focus
                  </label>
                  <Input
                    value={primaryLifeFocus}
                    onChange={(e) => setPrimaryLifeFocus(e.target.value)}
                    placeholder="e.g. Deep Work, Health & Vitality"
                  />
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    ORIGIN aligns your daily recommendations and check-ins with this focus.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Headline
                  </label>
                  <Input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Designer & Thinker"
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" isLoading={isSavingProfile}>
                    Save Profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Plan & Billing */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Plan & Billing</CardTitle>
                  <CardDescription>
                    Choose the right workspace capacity for your personal life OS.
                  </CardDescription>
                </div>
                <Badge variant={isPro ? 'primary' : 'outline'} size="md">
                  {isPro ? 'ORIGIN Pro Active' : 'Starter Plan (Free)'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Usage Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-1">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Active Habits</div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {billingDetails?.usage?.activeHabitsCount ?? 2}
                    <span className="text-xs font-normal text-neutral-400 ml-1">
                      / {isPro ? 'Unlimited' : '3 max'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-1">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Active Tasks</div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {billingDetails?.usage?.tasksCount ?? 4}
                    <span className="text-xs font-normal text-neutral-400 ml-1">
                      / {isPro ? 'Unlimited' : '25 max'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-1">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">AI Co-Pilot</div>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {isPro ? 'Unlimited' : '15 / day'}
                  </div>
                </div>
              </div>

              {/* Pricing Plans Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Starter Plan */}
                <div className="p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Starter</h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      Essential daily focus for calm living.
                    </p>
                  </div>
                  <div className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
                    $0 <span className="text-xs font-normal text-neutral-400">forever</span>
                  </div>
                  <ul className="space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Daily focus dashboard & task matrix</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Up to 3 atomic daily habits</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>1 active long-term goal</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>15 AI assistant questions / day</span>
                    </li>
                  </ul>
                  {!isPro && (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  )}
                </div>

                {/* Pro Plan */}
                <div className="p-6 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent space-y-4 relative">
                  <div className="absolute -top-3 right-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                    Recommended
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">ORIGIN Pro</h3>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      Complete life architecture with bank-grade privacy.
                    </p>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
                      {billingInterval === 'annual' ? '$99' : '$12'}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {billingInterval === 'annual' ? '/ year (save 31%)' : '/ month'}
                    </span>
                  </div>

                  {/* Interval Switcher */}
                  <div className="flex items-center rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setBillingInterval('monthly')}
                      className={`flex-1 py-1 rounded-md font-medium transition-colors ${
                        billingInterval === 'monthly'
                          ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                          : 'text-neutral-500'
                      }`}
                    >
                      Monthly ($12/mo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingInterval('annual')}
                      className={`flex-1 py-1 rounded-md font-medium transition-colors ${
                        billingInterval === 'annual'
                          ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                          : 'text-neutral-500'
                      }`}
                    >
                      Annual ($99/yr)
                    </button>
                  </div>

                  <ul className="space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                      <span><strong>Unlimited</strong> tasks, habits, and long-term goals</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                      <span><strong>Unlimited AI Co-Pilot</strong> with weekly life synthesis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                      <span><strong>Bank-Grade AES-256 Encryption</strong> for reflections & finances</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                      <span><strong>Life Correlation Engine</strong> across sleep, focus & mood</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>Bi-directional Notes knowledge graph</span>
                    </li>
                  </ul>

                  {isPro ? (
                    <Button variant="outline" className="w-full" disabled>
                      ✓ Pro Plan Active
                    </Button>
                  ) : (
                    <Button
                      onClick={handleUpgradeToPro}
                      isLoading={isUpgrading}
                      className="w-full shadow-md bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white"
                      rightIcon={<ArrowUpRight className="h-4 w-4" />}
                    >
                      Upgrade to ORIGIN Pro
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Appearance */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance & Theme</CardTitle>
              <CardDescription>
                Select your preferred visual style and display mode.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <Sun className="h-5 w-5 text-amber-600" />
                  <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">Light Theme</div>
                  <div className="text-[11px] text-neutral-500">Bright, warm contrast</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <Moon className="h-5 w-5 text-indigo-400" />
                  <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">Dark Theme</div>
                  <div className="text-[11px] text-neutral-500">Restful low-light contrast</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`p-4 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${
                    theme === 'system'
                      ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <Globe className="h-5 w-5 text-neutral-600 dark:text-neutral-300" />
                  <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">System Sync</div>
                  <div className="text-[11px] text-neutral-500">Matches device settings</div>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Schedule & Time */}
        <TabsContent value="localization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timezone & Daily Schedule</CardTitle>
              <CardDescription>
                Ensure habit reminders, daily resets, and calendar dates sync accurately with your location.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 max-w-xl">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Timezone
                </label>
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. America/New_York or Europe/London"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  First Day of Week
                </label>
                <div className="flex gap-2">
                  {[
                    { label: 'Monday', value: 1 as const },
                    { label: 'Sunday', value: 0 as const },
                    { label: 'Saturday', value: 6 as const },
                  ].map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setWeekStartDay(d.value)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                        weekStartDay === d.value
                          ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleSavePreferences}>Save Schedule Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Accessibility */}
        <TabsContent value="accessibility" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Accessibility Preferences</CardTitle>
              <CardDescription>
                Tailor the visual density and motion behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <Checkbox
                label="Reduce Motion"
                description="Disables non-essential animated transitions."
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
              />

              <Checkbox
                label="Compact View Density"
                description="Reduces spacing to display more items on screen."
                checked={compactDensity}
                onChange={(e) => setCompactDensity(e.target.checked)}
              />

              <div className="pt-2">
                <Button onClick={handleSavePreferences}>Save Accessibility Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Choose when you want reminders for daily check-ins and habit cadences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <Checkbox
                label="In-App Notifications"
                description="Shows updates and alerts while using the app."
                checked={inAppNotifs}
                onChange={(e) => setInAppNotifs(e.target.checked)}
              />

              <Checkbox
                label="Evening Reflection Prompt"
                description="Prompts you for a mindful 5-minute wind-down in the evening."
                checked={dailyDigest}
                onChange={(e) => setDailyDigest(e.target.checked)}
              />

              <div className="pt-2">
                <Button onClick={handleSavePreferences}>Save Notifications</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 7: Privacy & Security */}
        <TabsContent value="data" className="space-y-6">
          {/* Bank-Grade Security Badge */}
          <Card className="border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <CardTitle className="text-emerald-900 dark:text-emerald-100">
                  Bank-Grade Encryption & Zero Third-Party Tracking
                </CardTitle>
              </div>
              <CardDescription className="text-emerald-700 dark:text-emerald-300">
                Your private thoughts, personal reflections, and financial transactions are encrypted at rest with AES-256-GCM. We never sell your data or train public models on your personal logs.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Export Data */}
          <Card>
            <CardHeader>
              <CardTitle>Data Export & Ownership</CardTitle>
              <CardDescription>
                Download a portable JSON archive of your entire workspace at any time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
                <div>
                  <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Export All Workspace Data
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Downloads a clean JSON file containing all your tasks, habits, logs, goals, finances, reflections, notes, and contacts.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                  onClick={handleExportData}
                  isLoading={isExporting}
                >
                  Download Backup
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Viewer */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Security Audit History</CardTitle>
                  <CardDescription>
                    Immutable record of logins, password updates, and sensitive data exports.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={loadAuditLogs} isLoading={isLoadingLogs} leftIcon={<History className="h-3.5 w-3.5" />}>
                  View Logs
                </Button>
              </div>
            </CardHeader>
            {auditLogs.length > 0 && (
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">{log.action}</span>
                        <span className="text-neutral-400 ml-2">({log.resource})</span>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Danger Zone: Account Deletion */}
          <Card className="border-rose-300 dark:border-rose-900/50 bg-rose-500/5 dark:bg-rose-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                <CardTitle className="text-rose-900 dark:text-rose-100">Delete Account & Data</CardTitle>
              </div>
              <CardDescription className="text-rose-700 dark:text-rose-300">
                Permanently delete your account and erase all stored records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Type <span className="font-mono font-bold text-rose-600 dark:text-rose-400">DELETE</span> to confirm:
                </label>
                <Input
                  placeholder="DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="font-mono text-xs max-w-xs"
                />
              </div>

              <div className="pt-1">
                <Button
                  variant="danger"
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  disabled={deleteConfirmText.trim() !== 'DELETE'}
                  isLoading={isDeletingAccount}
                  onClick={handleDeleteAccount}
                >
                  Permanently Delete My Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
