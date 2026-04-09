/**
 * Settings Page — Apple macOS preferences style
 *
 * Tabs: Profile · Appearance (theme + font size) · Notifications · Security · Session
 *
 * Font size preference is persisted in localStorage and applied to :root via --ui-scale.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/components/ThemeProvider';
import { useLogout, useUpdateProfile } from '@/hooks/use-api';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Shield, Key, Sun, Moon, Monitor, Bell, BellOff, LogOut,
  Loader2, CheckCircle2, Palette, Lock, Save, Type, Minus, Plus,
  Fingerprint, Download, AlertTriangle, Clock, Globe, Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PasswordWithStrength from '@/components/PasswordWithStrength';

const ease = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

// ── Font/UI scale storage key ─────────────────────────────────────
const SCALE_KEY = 'forensi_ui_scale';
const SCALES = [
  { key: 'compact',  label: 'Compact',  value: 0.93, desc: 'More content per screen' },
  { key: 'default',  label: 'Default',  value: 1.00, desc: 'Standard size' },
  { key: 'medium',   label: 'Medium',   value: 1.07, desc: 'Slightly larger' },
  { key: 'large',    label: 'Large',    value: 1.14, desc: 'Easier to read' },
];

function applyScale(value: number) {
  document.documentElement.style.setProperty('--ui-scale', value.toString());
  (document.body.style as any).zoom = value.toString();
}

// ── Toggle component ─────────────────────────────────────────────
const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    role="switch"
    aria-checked={enabled}
    className={cn(
      'relative w-[42px] h-[24px] rounded-full border-2 transition-all duration-200 outline-none shrink-0',
      enabled
        ? 'bg-primary border-primary'
        : 'bg-muted/60 border-border/60 hover:border-border'
    )}
  >
    <motion.div
      className="absolute top-[1px] h-[18px] w-[18px] rounded-full bg-white shadow"
      animate={{ left: enabled ? 18 : 3 }}
      transition={{ duration: 0.17, ease: 'easeInOut' }}
    />
  </button>
);

// ── Setting row ──────────────────────────────────────────────────
const SettingRow = ({
  icon: Icon, iconColor = 'text-muted-foreground', iconBg = 'bg-muted/60',
  label, desc, action
}: {
  icon: typeof User; iconColor?: string; iconBg?: string;
  label: string; desc?: string; action: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3 py-3">
    <div className="flex items-center gap-3 min-w-0">
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg shrink-0', iconBg)}>
        <Icon className={cn('h-3.5 w-3.5', iconColor)} strokeWidth={1.7} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">{label}</p>
        {desc && <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>}
      </div>
    </div>
    <div className="shrink-0">{action}</div>
  </div>
);

// ── Main ─────────────────────────────────────────────────────────
const SettingsPage = () => {
  const { user, setUser } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const updateProfileMutation = useUpdateProfile();

  const [activeTab, setActiveTab] = useState('profile');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [saved, setSaved] = useState(false);

  // Font scale
  const [uiScale, setUiScale] = useState<string>(() => {
    return localStorage.getItem(SCALE_KEY) || 'default';
  });

  useEffect(() => {
    const preset = SCALES.find(s => s.key === uiScale);
    const numericValue = preset ? preset.value : parseFloat(uiScale);
    if (!isNaN(numericValue)) {
      applyScale(numericValue);
      localStorage.setItem(SCALE_KEY, uiScale);
    }
  }, [uiScale]);

  const tabs = [
    { id: 'profile',       label: 'Profile',       icon: User },
    { id: 'appearance',    label: 'Appearance',     icon: Palette },
    { id: 'notifications', label: 'Notifications',  icon: Bell },
    { id: 'security',      label: 'Security',       icon: Shield },
    { id: 'session',       label: 'Session',        icon: Globe },
  ];

  const handleProfileSave = async () => {
    if (!fullName.trim()) {
      toast({ title: 'Validation', description: 'Name cannot be empty.', variant: 'destructive' });
      return;
    }
    updateProfileMutation.mutate(
      { full_name: fullName.trim() },
      {
        onSuccess: (res: any) => {
          const updatedUser = res?.data?.user || res?.data || { ...user, full_name: fullName.trim() };
          setUser(updatedUser);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          toast({ title: 'Profile Updated' });
        },
      }
    );
  };

  const handlePasswordChange = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: 'Validation', description: 'Fill in all password fields.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Mismatch', description: 'New passwords do not match.', variant: 'destructive' });
      return;
    }
    const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);
    const hasNumAlp = /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword);
    if (newPassword.length < 8 || !hasSymbol || !hasNumAlp) {
      toast({ title: 'Weak Password', description: 'Password must be at least 8 chars, contain letters, numbers, and symbols.', variant: 'destructive' });
      return;
    }
    updateProfileMutation.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: () => {
          setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
          toast({ title: 'Password Changed' });
        },
      }
    );
  };

  const handleExportData = () => {
    const data = {
      user: { full_name: user?.full_name, email: user?.email, role: user?.role },
      exported_at: new Date().toISOString(),
      settings: { theme, ui_scale: uiScale, notifications_enabled: notificationsEnabled },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `settings-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: 'Exported' });
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, { onSettled: () => navigate('/login') });
  };

  const themes = [
    { key: 'light' as const, label: 'Light', icon: Sun,     desc: 'Clean white' },
    { key: 'dark' as const,  label: 'Dark',  icon: Moon,    desc: 'Dark theme' },
    { key: 'system' as const,label: 'System',icon: Monitor, desc: 'Follow device' },
  ];

  return (
    <div className="page-container max-w-3xl mx-auto space-y-5 pb-8">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease }}>
        <h1 className="text-[18px] font-extrabold tracking-tight">Settings</h1>
        <p className="text-[12px] text-muted-foreground mt-0.5">Account preferences, security, and interface customization</p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* Sidebar tabs */}
        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease }} className="md:w-[180px] shrink-0">
          <div className="flex md:flex-col gap-0.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all',
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}>
                <tab.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">

            {/* Profile */}
            {activeTab === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease }} className="space-y-4">
                <Card className="mac-card">
                  <CardContent className="p-5 space-y-5">
                    {/* Avatar row */}
                    <div className="flex items-center gap-4 pb-4 border-b border-border/25">
                      <div className="h-12 w-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
                        <span className="text-[18px] font-extrabold text-primary">
                          {(user?.full_name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-extrabold">{user?.full_name || 'User'}</p>
                        <p className="text-[11px] text-muted-foreground">{user?.email}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-md">
                        {user?.role || 'User'}
                      </span>
                    </div>

                    {/* Fields */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Full Name</Label>
                        <Input value={fullName} onChange={e => setFullName(e.target.value)}
                          className="h-9 text-[13px] rounded-lg" placeholder="Your full name" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Email</Label>
                        <Input value={user?.email || ''} disabled className="h-9 text-[13px] rounded-lg opacity-50" />
                        <p className="text-[10px] text-muted-foreground/60">Email cannot be changed</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/25">
                      <p className="text-[10px] text-muted-foreground">
                        Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A'}
                      </p>
                      <Button size="sm" className="h-8 text-[12px]" onClick={handleProfileSave}
                        disabled={updateProfileMutation.isPending || fullName === user?.full_name}>
                        {updateProfileMutation.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          : saved
                            ? <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                            : <Save className="h-3.5 w-3.5 mr-1.5" />}
                        {saved ? 'Saved!' : 'Save Changes'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Appearance */}
            {activeTab === 'appearance' && (
              <motion.div key="appearance" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease }} className="space-y-4">

                {/* Theme */}
                <Card className="mac-card">
                  <div className="px-5 py-3.5 border-b border-border/25">
                    <p className="text-[13px] font-bold">Theme</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Choose how the interface looks</p>
                  </div>
                  <CardContent className="p-5">
                    <div className="grid grid-cols-3 gap-3">
                      {themes.map(t => (
                        <button key={t.key} onClick={() => setTheme(t.key)}
                          className={cn(
                            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                            theme === t.key
                              ? 'border-primary bg-primary/5'
                              : 'border-border/40 bg-muted/20 hover:bg-muted/40'
                          )}>
                          <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg',
                            theme === t.key ? 'bg-primary/10' : 'bg-muted/60')}>
                            <t.icon className={cn('h-4.5 w-4.5', theme === t.key ? 'text-primary' : 'text-muted-foreground')} strokeWidth={1.5} />
                          </div>
                          <span className={cn('text-[12px] font-bold', theme === t.key ? 'text-primary' : 'text-foreground')}>{t.label}</span>
                          <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                          {theme === t.key && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Font / UI size */}
                <Card className="mac-card">
                  <div className="px-5 py-3.5 border-b border-border/25">
                    <p className="text-[13px] font-bold flex items-center gap-2">
                      <Type className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.7} />
                      Interface Size
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Adjusts the size of text and UI elements globally</p>
                  </div>
                  <CardContent className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {SCALES.map(s => (
                        <button key={s.key} onClick={() => setUiScale(s.key)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center',
                            uiScale === s.key
                              ? 'border-primary bg-primary/5'
                              : 'border-border/40 bg-muted/20 hover:bg-muted/40'
                          )}>
                          <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg',
                            uiScale === s.key ? 'bg-primary/10' : 'bg-muted/60')}>
                            <span className={cn('font-bold',
                              s.key === 'compact' ? 'text-[10px]' : s.key === 'default' ? 'text-[12px]' : s.key === 'medium' ? 'text-[13px]' : 'text-[15px]',
                              uiScale === s.key ? 'text-primary' : 'text-muted-foreground')}>
                              Aa
                            </span>
                          </div>
                          <span className={cn('text-[11px] font-bold', uiScale === s.key ? 'text-primary' : 'text-foreground')}>{s.label}</span>
                          <span className="text-[9px] text-muted-foreground">{s.desc}</span>
                          {uiScale === s.key && <CheckCircle2 className="h-3 w-3 text-primary" />}
                        </button>
                      ))}
                    </div>

                    {/* Custom Scaler */}
                    <div className="mt-5 border-t border-border/25 pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Custom Fine-Tuning
                        </Label>
                        <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {(() => {
                            const preset = SCALES.find(s => s.key === uiScale);
                            const val = preset ? preset.value : parseFloat(uiScale) || 1;
                            return (val * 100).toFixed(0) + '%';
                          })()}
                        </span>
                      </div>
                      <input 
                        type="range"
                        min="0.8" max="1.45" step="0.01"
                        value={(() => {
                            const preset = SCALES.find(s => s.key === uiScale);
                            return preset ? preset.value : parseFloat(uiScale) || 1;
                        })()}
                        onChange={e => setUiScale(e.target.value)}
                        className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <p className="text-[10px] text-muted-foreground/60 mt-4">
                      ✓ Persisted across sessions · Interface elements auto-adapt instantly
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <motion.div key="notifications" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease }}>
                <Card className="mac-card">
                  <div className="px-5 py-3.5 border-b border-border/25">
                    <p className="text-[13px] font-bold">Notification Preferences</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Control how and when you receive alerts</p>
                  </div>
                  <CardContent className="p-5 divide-y divide-border/20">
                    <div className="pb-3">
                      <SettingRow
                        icon={Bell} iconColor="text-primary" iconBg="bg-primary/8"
                        label="Push Notifications"
                        desc="Browser notifications for evidence events"
                        action={<Toggle enabled={notificationsEnabled} onToggle={() => setNotificationsEnabled(v => !v)} />}
                      />
                    </div>
                    <div className="py-3">
                      <SettingRow
                        icon={Mail} iconColor="text-blue-500" iconBg="bg-blue-500/8"
                        label="Email Alerts"
                        desc="Receive critical alerts via email"
                        action={<Toggle enabled={emailNotifications} onToggle={() => setEmailNotifications(v => !v)} />}
                      />
                    </div>
                    <div className="pt-3">
                      <SettingRow
                        icon={AlertTriangle} iconColor="text-red-500" iconBg="bg-red-500/8"
                        label="Security Alerts"
                        desc="Failed logins, tampered evidence, off-hours access"
                        action={<Toggle enabled={securityAlerts} onToggle={() => setSecurityAlerts(v => !v)} />}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Security */}
            {activeTab === 'security' && (
              <motion.div key="security" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease }} className="space-y-4">
                <Card className="mac-card">
                  <div className="px-5 py-3.5 border-b border-border/25">
                    <p className="text-[13px] font-bold">Change Password</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Update your account password</p>
                  </div>
                  <CardContent className="p-5 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Current Password</Label>
                      <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                        className="h-9 text-[13px] rounded-lg" placeholder="Enter current password" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 items-start">
                      <PasswordWithStrength
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        label="New Password"
                        placeholder="New password"
                      />
                      <div className="space-y-1.5 pt-0.5 mt-0.5">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
                        <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          className="h-9 text-[13px] rounded-lg mt-0.5" placeholder="Confirm password" />
                      </div>
                    </div>
                    {newPassword && newPassword !== confirmPassword && (
                      <p className="text-[11px] text-red-500">Passwords do not match</p>
                    )}
                    <div className="flex justify-end pt-2 border-t border-border/25">
                      <Button size="sm" className="h-8 text-[12px]" onClick={handlePasswordChange}
                        disabled={updateProfileMutation.isPending || !currentPassword || !newPassword}>
                        {updateProfileMutation.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          : <Key className="h-3.5 w-3.5 mr-1.5" />}
                        Update Password
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="mac-card">
                  <CardContent className="p-5">
                    <SettingRow
                      icon={Fingerprint} iconColor="text-amber-500" iconBg="bg-amber-500/8"
                      label="Two-Factor Authentication"
                      desc={twoFactorEnabled ? 'Extra layer of security is enabled' : 'Add an additional layer of security'}
                      action={
                        <Toggle enabled={twoFactorEnabled} onToggle={() => {
                          setTwoFactorEnabled(v => !v);
                          toast({ title: !twoFactorEnabled ? '2FA Enabled' : '2FA Disabled' });
                        }} />
                      }
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Session */}
            {activeTab === 'session' && (
              <motion.div key="session" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease }} className="space-y-4">
                <Card className="mac-card">
                  <div className="px-5 py-3.5 border-b border-border/25">
                    <p className="text-[13px] font-bold">Current Session</p>
                  </div>
                  <CardContent className="p-5 space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                        Active Session
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Browser: </span>
                          <span className="font-medium">
                            {navigator.userAgent.includes('Chrome') ? 'Chrome'
                              : navigator.userAgent.includes('Firefox') ? 'Firefox'
                              : navigator.userAgent.includes('Safari') ? 'Safari'
                              : 'Browser'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Platform: </span>
                          <span className="font-medium">{navigator.platform || 'Unknown'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">User: </span>
                          <span className="font-medium">{user?.full_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Role: </span>
                          <span className="font-medium capitalize">{user?.role || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="mac-card">
                  <CardContent className="p-5 space-y-2.5">
                    <p className="text-[12px] font-bold mb-3">Account Actions</p>
                    <Button variant="outline" className="w-full justify-start h-9 text-[12px] rounded-lg" onClick={handleExportData}>
                      <Download className="h-3.5 w-3.5 mr-2.5 text-muted-foreground" /> Export Settings & Data
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start h-9 text-[12px] rounded-lg text-destructive border-destructive/20 hover:bg-destructive/8 hover:text-destructive"
                      onClick={handleLogout} disabled={logoutMutation.isPending}
                    >
                      {logoutMutation.isPending
                        ? <Loader2 className="h-3.5 w-3.5 mr-2.5 animate-spin" />
                        : <LogOut className="h-3.5 w-3.5 mr-2.5" />}
                      Sign Out of All Sessions
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
