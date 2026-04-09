import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const LoadingSpinner = ({ className, text }: { className?: string; text?: string }) => (
  <div className={cn('flex flex-col items-center justify-center gap-2 py-12', className)}>
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
    {text && <p className="text-sm text-muted-foreground">{text}</p>}
  </div>
);

export default LoadingSpinner;
