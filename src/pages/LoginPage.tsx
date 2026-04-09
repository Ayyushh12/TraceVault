/**
 * Login Page — Split-panel layout (Apple / Notion / Linear style)
 *
 * Layout:
 *   Left (hidden on mobile):
 *     Soft gradient background (#F0F2F5 light / #0D0D10 dark)
 *     App logo + name + tagline
 *     Feature list (3 bullet points with minimal icons)
 *
 *   Right:
 *     White card (glassmorphism on desktop, full-height on mobile)
 *     "Authorized Personnel Only" badge
 *     Email + Password form
 *     Submit button
 *
 * Motion: 250ms ease-in-out-cubic, no bounce, no glow
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useLogin } from '@/hooks/use-api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Lock, Mail, ArrowRight, CheckCircle2, Eye, EyeOff,
  Fingerprint, Hash, Link2, FileSearch, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const ease = [0.28, 0.11, 0.32, 1] as const;

// ── Platform features listed on the left panel ───────────────────
const FEATURES = [
  {
    icon: Hash,
    title: 'Multi-Layer Integrity',
    desc: 'SHA-256 · SHA-1 · MD5 · Merkle trees · Chunk-level verification',
  },
  {
    icon: Link2,
    title: 'Immutable Chain of Custody',
    desc: 'Hash-chained, tamper-resistant legal records with digital signatures',
  },
  {
    icon: FileSearch,
    title: 'Rule-Based Risk Intelligence',
    desc: 'Anomaly detection, evidence scoring, and duplicate correlation engine',
  },
];

// ── Left panel gradient (light / dark adaptive) ───────────────────
const LeftPanel = () => (
  <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-10 relative overflow-hidden
    bg-[#F5F5F7] dark:bg-[#0D0D10]
    border-r border-border/40">

    {/* Subtle background pattern */}
    <div className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `radial-gradient(circle at 20% 20%, rgba(0,122,255,0.06) 0%, transparent 60%),
                          radial-gradient(circle at 80% 80%, rgba(88,86,214,0.05) 0%, transparent 60%)`,
      }} />

    {/* Top: Logo */}
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 border border-primary/15">
          <Fingerprint className="h-5 w-5 text-primary" strokeWidth={1.7} />
        </div>
        <div>
          <p className="text-[16px] font-extrabold tracking-tight">TraceVault</p>
          <p className="text-[10px] text-muted-foreground">Digital Evidence Platform</p>
        </div>
      </div>
    </motion.div>

    {/* Middle: Tagline + Features */}
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4, ease }} className="space-y-8">
      <div>
        <h2 className="text-[28px] font-extrabold tracking-tight leading-snug text-foreground">
          Evidence integrity<br />you can prove in court.
        </h2>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed">
          Industry-standard cryptographic verification for digital forensics investigations.
        </p>
      </div>

      <div className="space-y-4">
        {FEATURES.map((f, i) => (
          <motion.div key={f.title}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18 + i * 0.07, duration: 0.35, ease }}
            className="flex items-start gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/8 dark:bg-primary/10 border border-primary/15 shrink-0 mt-0.5">
              <f.icon className="h-4 w-4 text-primary" strokeWidth={1.7} />
            </div>
            <div>
              <p className="text-[12px] font-bold">{f.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>

    {/* Bottom: compliance note */}
    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.4, ease }}
      className="text-[10px] text-muted-foreground/50">
      NIST SP 800-101r1 compliant · AES-256-GCM encryption · Ed25519 signatures
    </motion.p>
  </div>
);

// ── Main page component ───────────────────────────────────────────
const LoginPage = () => {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [focused, setFocused]       = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const navigate = useNavigate();
  const loginMutation = useLogin();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Missing Fields', description: 'Please enter your email and password.', variant: 'destructive' });
      return;
    }
    loginMutation.mutate({ email, password }, {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(() => navigate('/dashboard'), 700);
      },
    });
  };

  return (
    <div className="flex min-h-[100dvh] bg-background">

      {/* Left branding panel */}
      <LeftPanel />

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-10
        bg-white dark:bg-[#09090B]">

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
          className="w-full max-w-[360px] space-y-6">

          {/* Mobile-only logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
              <Fingerprint className="h-4.5 w-4.5 text-primary" strokeWidth={1.7} />
            </div>
            <p className="text-[15px] font-extrabold">TraceVault</p>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight">Sign in to your account</h1>
            <p className="text-[12px] text-muted-foreground mt-1">
              Contact your administrator for access credentials
            </p>
          </div>

          {/* Access badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
            bg-[#F5F5F7] dark:bg-white/5 border border-border/40">
            <ShieldCheck className="h-3 w-3 text-primary" strokeWidth={1.8} />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Authorized Personnel Only
            </span>
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="success"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, ease }}
                className="flex flex-col items-center gap-3 py-10">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" strokeWidth={1.5} />
                <p className="text-[13px] font-bold">Authentication Successful</p>
                <p className="text-[11px] text-muted-foreground">Redirecting to dashboard…</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={handleLogin}
                className="space-y-4"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease }}>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email"
                    className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Email Address
                  </Label>
                  <div className={cn('relative rounded-lg transition-all duration-200',
                    focused === 'email' ? 'ring-2 ring-primary/20 ring-offset-0' : '')}>
                    <Mail className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none transition-colors duration-200',
                      focused === 'email' ? 'text-primary' : 'text-muted-foreground/40')} strokeWidth={1.6} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="investigator@agency.gov"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused(null)}
                      autoComplete="email"
                      className="h-10 pl-9 text-[13px] rounded-lg bg-[#F5F5F7] dark:bg-white/5 border-border/40
                        focus-visible:ring-0 focus-visible:border-transparent
                        placeholder:text-muted-foreground/35 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password"
                    className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Password
                  </Label>
                  <div className={cn('relative rounded-lg transition-all duration-200',
                    focused === 'password' ? 'ring-2 ring-primary/20 ring-offset-0' : '')}>
                    <Lock className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none transition-colors duration-200',
                      focused === 'password' ? 'text-primary' : 'text-muted-foreground/40')} strokeWidth={1.6} />
                    <Input
                      id="password"
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')}
                      onBlur={() => setFocused(null)}
                      autoComplete="current-password"
                      className="h-10 pl-9 pr-9 text-[13px] rounded-lg bg-[#F5F5F7] dark:bg-white/5 border-border/40
                        focus-visible:ring-0 focus-visible:border-transparent
                        placeholder:text-muted-foreground/35 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40
                        hover:text-muted-foreground transition-colors duration-200">
                      {showPw
                        ? <EyeOff className="h-3.5 w-3.5" strokeWidth={1.6} />
                        : <Eye className="h-3.5 w-3.5" strokeWidth={1.6} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {loginMutation.isError && (
                  <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] text-red-500 font-medium">
                    Invalid credentials. Please try again.
                  </motion.p>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full h-10 text-[13px] font-semibold rounded-lg"
                  disabled={loginMutation.isPending}>
                  {loginMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <>Sign In <ArrowRight className="h-4 w-4 ml-1.5" /></>}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer */}
          <p className="text-[10px] text-muted-foreground/40 text-center">
            TraceVault — Digital Evidence Integrity Platform
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
