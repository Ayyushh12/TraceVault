import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Key, Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordWithStrengthProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
}

export default function PasswordWithStrength({
  value,
  onChange,
  placeholder = '••••••••',
  className,
  label = 'Password',
  required,
}: PasswordWithStrengthProps) {
  const [show, setShow] = useState(false);
  const [isPwned, setIsPwned] = useState<boolean | null>(null);
  const [isCheckingPwned, setIsCheckingPwned] = useState(false);

  // Strength regex
  const hasMinLength = value.length >= 8;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);

  // Score 0 -> 4
  const score = [hasMinLength, hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length - 1;

  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'];
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

  const color = score >= 0 ? strengthColors[score] : 'bg-muted-foreground/20';
  const textLabel = score >= 0 ? strengthLabels[score] : 'Enter password';

  useEffect(() => {
    if (value.length < 5) {
      setIsPwned(null);
      return;
    }

    const checkPwned = async () => {
      try {
        setIsCheckingPwned(true);
        // SHA-1 hash for k-anonymity HaveIBeenPwned API
        const buffer = new TextEncoder().encode(value);
        const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

        const prefix = hashHex.slice(0, 5);
        const suffix = hashHex.slice(5);

        const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
        if (!res.ok) throw new Error('Failed to fetch from HaveIBeenPwned');
        const text = await res.text();
        const suffixes = text.split('\n').map(line => line.split(':')[0]);
        
        setIsPwned(suffixes.includes(suffix));
      } catch (err) {
        console.error('Pwned check failed', err);
        setIsPwned(null);
      } finally {
        setIsCheckingPwned(false);
      }
    };

    const timer = setTimeout(checkPwned, 600);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="space-y-1.5 w-full">
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn('h-9 text-[13px] rounded-lg pr-10', className)}
          required={required}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground outline-none"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <AnimatePresence>
        {value.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-1.5 space-y-2 overflow-hidden"
          >
            {/* Bars */}
            <div className="flex items-center gap-1 h-1.5">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-full rounded-full transition-colors duration-300',
                    score >= i ? color : 'bg-muted'
                  )}
                />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10.5px]">
              <span className={cn('font-bold', score >= 3 ? 'text-emerald-500' : 'text-muted-foreground')}>
                Strength: {textLabel}
              </span>

              {/* Pwned Status */}
              <div className="flex items-center gap-1.5 font-medium">
                {isCheckingPwned ? (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Checking leak databases...
                  </span>
                ) : isPwned === true ? (
                  <span className="text-destructive flex items-center gap-1 bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20">
                    <ShieldAlert className="h-3 w-3" /> Password found in data breaches
                  </span>
                ) : isPwned === false ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> No known leaks
                  </span>
                ) : null}
              </div>
            </div>

            {/* Requirements grid */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-muted-foreground pt-0.5">
              <span className={cn('flex items-center gap-1.5', hasMinLength ? 'text-primary' : '')}>
                <div className={cn('h-1 w-1 rounded-full', hasMinLength ? 'bg-primary' : 'bg-muted-foreground/30')} />
                8+ characters
              </span>
              <span className={cn('flex items-center gap-1.5', hasUpper && hasLower ? 'text-primary' : '')}>
                <div className={cn('h-1 w-1 rounded-full', hasUpper && hasLower ? 'bg-primary' : 'bg-muted-foreground/30')} />
                Upper/Lowercase
              </span>
              <span className={cn('flex items-center gap-1.5', hasNumber ? 'text-primary' : '')}>
                <div className={cn('h-1 w-1 rounded-full', hasNumber ? 'bg-primary' : 'bg-muted-foreground/30')} />
                Numbers (0-9)
              </span>
              <span className={cn('flex items-center gap-1.5', hasSymbol ? 'text-primary' : '')}>
                <div className={cn('h-1 w-1 rounded-full', hasSymbol ? 'bg-primary' : 'bg-muted-foreground/30')} />
                Symbols (!@#)
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
