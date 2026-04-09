import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, Clock, HelpCircle } from 'lucide-react';

type IntegrityStatus = 'Verified' | 'Tampered' | 'Pending' | 'Unknown';

interface IntegrityStatusBadgeProps {
  status: IntegrityStatus;
  className?: string;
}

const config: Record<IntegrityStatus, { icon: typeof ShieldCheck; className: string; label: string }> = {
  Verified: { icon: ShieldCheck, className: 'status-verified', label: 'Verified' },
  Tampered: { icon: ShieldAlert, className: 'status-tampered', label: 'Tampered' },
  Pending: { icon: Clock, className: 'status-pending', label: 'Pending' },
  Unknown: { icon: HelpCircle, className: 'status-unknown', label: 'Unknown' },
};

const IntegrityStatusBadge = ({ status, className }: IntegrityStatusBadgeProps) => {
  const c = config[status] || config.Unknown;
  const Icon = c.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', c.className, className)}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
};

export default IntegrityStatusBadge;
