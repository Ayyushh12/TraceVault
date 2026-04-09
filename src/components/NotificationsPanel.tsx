import { useState, useMemo } from 'react';
import { Bell, ShieldAlert, GitBranch, Info, Check, X, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDismissNotification } from '@/hooks/use-api';
import { useQueryClient } from '@tanstack/react-query';

const severityConfig: Record<string, { icon: any; color: string; bg: string }> = {
  CRITICAL: { icon: ShieldAlert, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  INFO: { icon: Info, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  SYSTEM: { icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted' },
};

const macEase = [0.28, 0.11, 0.32, 1] as const;

function timeAgo(dateStr: string): string {
  if (!dateStr) return 'just now';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

const NotificationsPanel = () => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Only fetch notifications when the panel is open — no background polling
  const { data, isLoading } = useNotifications({ limit: 20 }, open);
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const dismissMutation = useDismissNotification();

  // Refresh notifications when panel is opened
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Refetch fresh data when user opens the panel
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  const items = useMemo(() => {
     if (!data) return [];
     if (Array.isArray(data)) return data;
     if (data.notifications) return data.notifications;
     if (data.data && Array.isArray(data.data.notifications)) return data.data.notifications;
     return [];
  }, [data]);

  const unreadCount = data?.unread_count || items.filter((n: any) => !n.read).length || 0;

  const markAllRead = () => {
    markAllReadMutation.mutate();
    setOpen(false);
  };

  const markRead = (id: string, currentRead: boolean) => {
    if (!currentRead) {
      markReadMutation.mutate(id);
    }
  };

  const dismiss = (id: string) => {
    dismissMutation.mutate(id);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-[28px] w-[28px] rounded-full relative text-muted-foreground hover:text-foreground hover:bg-background/80"
        >
          <Bell className="h-4 w-4" strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute top-[3px] right-[4px] h-[7px] w-[7px] rounded-full bg-danger ring-[2px] ring-background shrink-0" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-[360px] p-0 rounded-[16px] border border-border/50 bg-card/95 backdrop-blur-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold tracking-tight">Notifications</h3>
            {unreadCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white shadow-sm">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors">
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto sidebar-scroll border-b border-border/50">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-[13px] font-medium text-muted-foreground/80">All caught up</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">You have no new notifications.</p>
                </div>
              ) : (
                items.map((notification: any) => {
                  const config = severityConfig[notification.severity || 'INFO'] || severityConfig['INFO'];
                  const Icon = config.icon;
                  return (
                    <motion.div
                      key={notification._id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2, ease: macEase }}
                    >
                      <div
                        className={cn(
                          'group relative flex gap-3 px-4 py-3 border-b border-border/30 last:border-b-0 cursor-pointer overflow-hidden transition-all duration-200',
                          !notification.read ? 'bg-primary/[0.03] hover:bg-primary/[0.05]' : 'hover:bg-muted/40'
                        )}
                        onClick={() => markRead(notification._id, notification.read)}
                      >
                        {!notification.read && (
                          <div className="absolute left-[3px] top-1/2 -translate-y-1/2 w-[3px] h-[16px] rounded-r-full bg-primary" />
                        )}
                        <div className={cn('flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] mt-0.5', config.bg)}>
                          <Icon className={cn('h-[15px] w-[15px]', config.color)} strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                             <p className={cn('text-[13px] leading-tight flex-1 truncate', !notification.read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
                                {notification.title}
                             </p>
                             {notification.group_count > 1 && (
                                <span className="shrink-0 text-[9px] font-bold bg-muted px-1.5 rounded-sm text-muted-foreground">x{notification.group_count}</span>
                             )}
                          </div>
                          
                          <p className={cn("text-[11px] mt-1 leading-snug line-clamp-2", !notification.read ? "text-muted-foreground" : "text-muted-foreground/70")}>
                            {notification.description}
                          </p>
                          <p className="text-[10.5px] text-muted-foreground/60 mt-1.5 font-medium tracking-tight uppercase">
                             {timeAgo(notification.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-background/50 backdrop-blur-[2px] p-1 rounded-md shadow-sm border border-border/50">
                          {!notification.read && (
                            <button onClick={(e) => { e.stopPropagation(); markRead(notification._id, false); }} className="p-1 rounded-[4px] hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Mark as read">
                              <Check className="h-3 w-3" strokeWidth={2} />
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); dismiss(notification._id); }} className="p-1 rounded-[4px] hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Dismiss">
                            <X className="h-3 w-3" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          )}
        </div>
        <div className="p-2 bg-muted/20">
          <Button 
            variant="ghost" 
            className="w-full text-xs font-medium h-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
               setOpen(false);
               window.location.href = '/notifications';
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPanel;
