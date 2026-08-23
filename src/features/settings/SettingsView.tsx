import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Checkbox } from '../../components/ui/Checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs';
import { Badge } from '../../components/ui/Badge';
import { envConfig } from '../../config/env.config';
import {
  Sun,
  Moon,
  Monitor,
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
} from 'lucide-react';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
];

export function SettingsView() {
  const navigate = useNavigate();
  const { user, updateProfile, updateUserPreferences, exportUserData, deleteAccount } = useAuth();
  const { theme, setTheme } = useTheme();
  const { success, error, info } = useToast();

  // Profile Form State
  const [displayName, setDisplayName] = useState(user?.profile.displayName || 'Alex Vance');
  const [headline, setHeadline] = useState(user?.profile.headline || 'Systems Architect');
  const [bio, setBio] = useState(user?.profile.bio || 'Designing deliberate personal operating systems.');
  const [avatarUrl, setAvatarUrl] = useState(user?.profile.avatarUrl || '');
  const [primaryLifeFocus, setPrimaryLifeFocus] = useState(user?.profile.primaryLifeFocus || 'High Performance Engineering & Health');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Timezone & Locale
  const [timezone, setTimezone] = useState(user?.preferences.timezone || 'UTC');
  const [weekStartDay, setWeekStartDay] = useState<0 | 1 | 6>(user?.preferences.weekStartDay ?? 1);

  // Accessibility state
  const [reducedMotion, setReducedMotion] = useState(user?.preferences.reducedMotion ?? false);
  const [compactDensity, setCompactDensity] = useState(user?.preferences.compactDensity ?? false);

  // Notification state
  const [inAppNotifs, setInAppNotifs] = useState(user?.preferences.notificationChannels.inApp ?? true);
  const [dailyDigest, setDailyDigest] = useState(user?.preferences.notificationChannels.dailyDigest ?? true);

  // Account Deletion State
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Sync state when user changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.profile.displayName);
      setHeadline(user.profile.headline || '');
      setBio(user.profile.bio || '');
      setAvatarUrl(user.profile.avatarUrl || '');
      setPrimaryLifeFocus(user.profile.primaryLifeFocus || '');
      setTimezone(user.preferences.timezone);
      setWeekStartDay(user.preferences.weekStartDay);
      setReducedMotion(user.preferences.reducedMotion);
      setCompactDensity(user.preferences.compactDensity);
      setInAppNotifs(user.preferences.notificationChannels.inApp);
      setDailyDigest(user.preferences.notificationChannels.dailyDigest);
    }
  }, [user]);

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
        success('Profile Updated', 'Your identity and profile metadata have been saved.');
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
      success('Preferences Saved', 'Your system preferences have been persisted.');
    } catch {
      error('Update Failed', 'Failed to update preferences.');
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
      link.download = `origin_full_export_${user?.id || 'me'}_${dateStr}.json`;
      link.click();
      URL.revokeObjectURL(url);
      success('Complete Data Export Generated', 'Your full multi-domain database has been exported.');
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
        success('Account Permanently Deleted', 'All data stores associated with your identity have been erased.');
        navigate('/auth/login');
      } else {
        error('Deletion Failed', res.error || 'Could not complete account deletion.');
      }
    } catch {
      error('Deletion Error', 'An error occurred during account deletion.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      <PageHeader
        title="Settings & System Preferences"
        description="Configure appearance, operator profile, timezone schedules, accessibility, and sovereign data exports."
        breadcrumbs={[{ label: 'ORIGIN' }, { label: 'Settings' }]}
      />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile" leftIcon={<User className="h-3.5 w-3.5" />}>
            Operator Profile
          </TabsTrigger>
          <TabsTrigger value="appearance" leftIcon={<Sun className="h-3.5 w-3.5" />}>
            Appearance & Theme
          </TabsTrigger>
          <TabsTrigger value="localization" leftIcon={<Globe className="h-3.5 w-3.5" />}>
            Time & Schedule
          </TabsTrigger>
          <TabsTrigger value="accessibility" leftIcon={<Eye className="h-3.5 w-3.5" />}>
            Accessibility
          </TabsTrigger>
          <TabsTrigger value="notifications" leftIcon={<Bell className="h-3.5 w-3.5" />}>
            Notifications
          </TabsTrigger>
          <TabsTrigger value="ai" leftIcon={<Sparkles className="h-3.5 w-3.5" />}>
            AI Co-Pilot
          </TabsTrigger>
          <TabsTrigger value="data" leftIcon={<Shield className="h-3.5 w-3.5" />}>
            Data & Privacy
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profile */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Operator Identity</CardTitle>
              <CardDescription>
                Personalize your operator identity, display handle, and life focus inside ORIGIN.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-5 max-w-xl">
                {/* Avatar Preview and Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Profile Avatar
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
                        <span>{displayName ? displayName.slice(0, 2).toUpperCase() : 'OP'}</span>
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
                            <img src={preset} alt={`Preset ${idx + 1}`} className="h-full w-full object-cover" />
                          </button>
                        ))}
                        {avatarUrl && (
                          <button
                            type="button"
                            onClick={() => setAvatarUrl('')}
                            className="text-[10px] text-rose-500 hover:underline cursor-pointer ml-1"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Input
                  label="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />

                <Input
                  label="Professional Headline / Craft"
                  placeholder="e.g. Systems Architect & Founder"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />

                <Input
                  label="Primary Life Horizon Focus"
                  placeholder="e.g. Health & High Performance Execution"
                  value={primaryLifeFocus}
                  onChange={(e) => setPrimaryLifeFocus(e.target.value)}
                />

                <Textarea
                  label="Personal Bio & Directives"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                />

                <div className="pt-2 flex items-center justify-between">
                  <Button type="submit" isLoading={isSavingProfile}>
                    Save Operator Profile
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (user?.id) {
                        localStorage.removeItem(`origin_onboarding_completed_${user.id}`);
                        window.location.reload();
                      }
                    }}
                    className="text-xs rounded-full"
                  >
                    Recalibrate Priorities & Onboarding
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Appearance */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interface Theme</CardTitle>
              <CardDescription>
                Choose how ORIGIN appears on your screen. System mode automatically matches your operating system setting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTheme('light');
                    info('Light theme activated');
                  }}
                  className={`relative flex flex-col items-center justify-center p-5 rounded-xl border text-center transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'border-neutral-900 bg-white dark:bg-neutral-800 ring-2 ring-neutral-900 dark:ring-neutral-100 shadow-md'
                      : 'border-neutral-200 bg-neutral-50/70 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900'
                  }`}
                >
                  {theme === 'light' && (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-neutral-900 dark:bg-neutral-100 ring-2 ring-white dark:ring-neutral-900" />
                  )}
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-2.5">
                    <Sun className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">Light</span>
                  <span className="text-[11px] text-neutral-500 mt-0.5">High contrast daytime</span>
                  <span className={`mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    theme === 'light'
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'bg-transparent text-transparent'
                  }`}>
                    Active
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTheme('dark');
                    info('Dark theme activated');
                  }}
                  className={`relative flex flex-col items-center justify-center p-5 rounded-xl border text-center transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 text-white ring-2 ring-neutral-900 dark:ring-neutral-100 shadow-md'
                      : 'border-neutral-200 bg-neutral-50/70 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900'
                  }`}
                >
                  {theme === 'dark' && (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-purple-400 ring-2 ring-neutral-900" />
                  )}
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2.5">
                    <Moon className="h-5 w-5" />
                  </div>
                  <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'}`}>Dark</span>
                  <span className={`text-[11px] mt-0.5 ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-500'}`}>Eye-safe twilight</span>
                  <span className={`mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    theme === 'dark'
                      ? 'bg-white text-neutral-900'
                      : 'bg-transparent text-transparent'
                  }`}>
                    Active
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTheme('system');
                    info('System theme mode activated');
                  }}
                  className={`relative flex flex-col items-center justify-center p-5 rounded-xl border text-center transition-all cursor-pointer ${
                    theme === 'system'
                      ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-800 ring-2 ring-neutral-900 dark:ring-neutral-100 shadow-md'
                      : 'border-neutral-200 bg-neutral-50/70 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900'
                  }`}
                >
                  {theme === 'system' && (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white dark:ring-neutral-900" />
                  )}
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-2.5">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">System</span>
                  <span className="text-[11px] text-neutral-500 mt-0.5">Follow OS preference</span>
                  <span className={`mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    theme === 'system'
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'bg-transparent text-transparent'
                  }`}>
                    Active
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Time & Schedule */}
        <TabsContent value="localization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timezone & Calendar Cadence</CardTitle>
              <CardDescription>
                Ensure accurate streak calculations, habit day boundaries, and task due dates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Primary Timezone
                </label>
                <select
                  aria-label="Primary timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="UTC">UTC (Universal Time Coordinated)</option>
                  <option value="America/New_York">Eastern Time (US / Canada)</option>
                  <option value="America/Chicago">Central Time (US / Canada)</option>
                  <option value="America/Denver">Mountain Time (US / Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US / Canada)</option>
                  <option value="Europe/London">London / GMT</option>
                  <option value="Europe/Paris">Paris / Berlin / CET</option>
                  <option value="Asia/Tokyo">Tokyo / JST</option>
                  <option value="Asia/Singapore">Singapore / SGT</option>
                  <option value="Australia/Sydney">Sydney / AEST</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  First Day of the Week
                </label>
                <select
                  aria-label="First day of the week"
                  value={weekStartDay}
                  onChange={(e) => setWeekStartDay(parseInt(e.target.value, 10) as 0 | 1 | 6)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                >
                  <option value={1}>Monday (ISO Standard)</option>
                  <option value={0}>Sunday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>

              <div className="pt-2">
                <Button onClick={handleSavePreferences}>Save Time Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Accessibility */}
        <TabsContent value="accessibility" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Accessibility Controls</CardTitle>
              <CardDescription>
                Customize motion sensitivity, interaction density, and visual clarity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 max-w-xl">
              <Checkbox
                label="Reduce Motion"
                description="Minimizes UI animations and disables non-essential transitions."
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
              />

              <Checkbox
                label="Compact Layout Density"
                description="Increases information density by reducing default padding and margins."
                checked={compactDensity}
                onChange={(e) => setCompactDensity(e.target.checked)}
              />

              <div className="pt-2">
                <Button onClick={handleSavePreferences}>Save Accessibility Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>
                Choose how and when ORIGIN alerts you about habit cadences, reflection prompts, and insights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 max-w-xl">
              <Checkbox
                label="In-App Real-Time Alerts"
                description="Displays toasts and notification badge updates inside the application."
                checked={inAppNotifs}
                onChange={(e) => setInAppNotifs(e.target.checked)}
              />

              <Checkbox
                label="Evening Reflection Digest"
                description="Prompts an intentional daily retrospective at your configured evening time."
                checked={dailyDigest}
                onChange={(e) => setDailyDigest(e.target.checked)}
              />

              <div className="pt-2">
                <Button onClick={handleSavePreferences}>Save Notification Channels</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: AI Co-Pilot */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Co-Pilot & Directives</CardTitle>
              <CardDescription>
                Configure intelligence model execution, user directives, and domain grounding privacy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 max-w-2xl">
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      ORIGIN Intelligence Architecture
                    </span>
                  </div>
                  <Badge variant="primary" size="sm">Gemini 2.5 Flash</Badge>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  ORIGIN runs server-side AI proxying with zero client-side credential leakage. Context is dynamically filtered so the AI only receives entities strictly relevant to your current prompt intent.
                </p>
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/app/ai')}
                    leftIcon={<Sparkles className="h-3.5 w-3.5 text-purple-500" />}
                  >
                    Open AI Studio & Memory Directives
                  </Button>
                </div>
              </div>

              <div className="space-y-3 border-t border-neutral-200 dark:border-neutral-800 pt-4">
                <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Safety & Mutation Policy
                </h4>
                <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-2 list-disc pl-4">
                  <li><strong>Gated Mutations:</strong> AI can never modify tasks, goals, habits, or transactions without your explicit confirmation.</li>
                  <li><strong>Domain Minimization:</strong> Intent classifier strips unrequested modules (e.g. asking about tasks never attaches relationship notes).</li>
                  <li><strong>Client Safety:</strong> API keys are strictly hosted in backend container environment variables.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 7: Data & Privacy */}
        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Sovereignty & Local Export</CardTitle>
              <CardDescription>
                You own 100% of your data. Export your configuration and system state at any time in structured JSON format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
                <div>
                  <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Export Full Workspace Configuration
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Generates an offline portable JSON backup containing your user preferences, tasks, habits, goals, finances, reflections, notes, and AI memories.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                  onClick={handleExportData}
                  isLoading={isExporting}
                >
                  Download Complete Archive
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 text-xs text-neutral-500 space-y-1">
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">System Environment Diagnostic:</p>
                <p>Environment: {envConfig.isProduction ? 'Production' : 'Development Container'}</p>
                <p>App Version: {envConfig.appVersion}</p>
                <p>Client Security: Isolated User ID Scopes & Token Expiration Engine</p>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone: Account Deletion */}
          <Card className="border-rose-300 dark:border-rose-900/50 bg-rose-500/5 dark:bg-rose-950/20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                <CardTitle className="text-rose-900 dark:text-rose-100">Danger Zone: Permanent Account Deletion</CardTitle>
              </div>
              <CardDescription className="text-rose-700 dark:text-rose-300">
                Irreversible destructive operation. Once deleted, all associated data cannot be recovered.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="p-3 rounded-lg bg-rose-100/50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                <p className="font-bold">This will permanently delete:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>All tasks, subtasks, projects, and backlog items</li>
                  <li>All life goals, milestones, and progress history</li>
                  <li>All atomic habits, completion logs, and streak metrics</li>
                  <li>All financial transactions, category budgets, and cashflow records</li>
                  <li>All reflections, energy check-ins, relationships, and knowledge notes</li>
                  <li>All custom AI memories and conversation history</li>
                </ul>
              </div>

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
                  Permanently Delete My Account & All Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
