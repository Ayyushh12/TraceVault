import { useState, useMemo } from 'react';
import { ShieldAlert, AlertTriangle, Info, AlertCircle, Check, X, CheckSquare, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDismissNotification } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const severityConfig: Record<string, { icon: any; color: string; bg: string }> = {
  CRITICAL: { icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  INFO: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  SYSTEM: { icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

export default function NotificationCenterPage() {
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterRead, setFilterRead] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useNotifications({ 
    limit: 100,
    unreadOnly: filterRead === 'UNREAD' ? true : undefined,
    severity: filterSeverity === 'ALL' ? undefined : filterSeverity
  });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const dismissMutation = useDismissNotification();

  const rawItems = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.notifications) return data.notifications;
    if (data.data?.notifications) return data.data.notifications;
    return [];
  }, [data]);

  const items = useMemo(() => {
    return rawItems.filter((n: any) => {
      // Severity and Read sorting is now handled efficiently by the backend via the hook params
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (n.title || '').toLowerCase().includes(q) || (n.description || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [rawItems, searchQuery]);

  const markAllRead = () => {
    markAllReadMutation.mutate();
  };

  const markRead = (id: string, currentRead: boolean) => {
    if (!currentRead) markReadMutation.mutate(id);
  };

  const dismiss = (id: string) => {
    dismissMutation.mutate(id);
  };

  return (
    <div className="flex-1 space-y-6 max-w-4xl mx-auto py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your alerts, system updates, and security events.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={markAllRead} className="h-9 gap-2">
             <CheckSquare className="h-4 w-4" />
             Mark all as read
           </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-xl border border-border/50 shadow-sm">
         <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search notifications..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full"
            />
         </div>
         <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg shrink-0">
               {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(sev => (
                 <button
                   key={sev}
                   onClick={() => setFilterSeverity(sev)}
                   className={cn(
                     "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                     filterSeverity === sev ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                   )}
                 >
                   {sev === 'ALL' ? 'All Types' : sev}
                 </button>
               ))}
            </div>
            <div className="w-[1px] h-6 bg-border mx-1 shrink-0" />
            <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg shrink-0">
               {['ALL', 'UNREAD'].map(status => (
                 <button
                   key={status}
                   onClick={() => setFilterRead(status)}
                   className={cn(
                     "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                     filterRead === status ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                   )}
                 >
                   {status === 'ALL' ? 'All' : 'Unread'}
                 </button>
               ))}
            </div>
         </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {isLoading ? (
           <div className="flex flex-col items-center justify-center py-20">
             <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
             <p className="mt-4 text-sm text-muted-foreground">Loading notifications...</p>
           </div>
        ) : (
          <div className="divide-y divide-border/30">
            <AnimatePresence initial={false}>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Info className="h-10 w-10 mb-4 opacity-20" />
                  <p className="text-sm font-medium">No notifications found</p>
                  <p className="text-xs mt-1 text-muted-foreground/60">Try adjusting your filters or search query.</p>
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
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                         "group flex items-start gap-4 p-4 transition-colors hover:bg-muted/40",
                         !notification.read && "bg-primary/[0.02] hover:bg-primary/[0.04]"
                      )}
                    >
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', config.bg)}>
                         <Icon className={cn('h-5 w-5', config.color)} strokeWidth={2} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                           <h4 className={cn("text-sm transition-colors", !notification.read ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                             {notification.title}
                           </h4>
                           {!notification.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                           )}
                           {notification.group_count > 1 && (
                              <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                                x{notification.group_count}
                              </span>
                           )}
                           <span className="ml-auto text-xs text-muted-foreground">
                             {new Date(notification.created_at).toLocaleString()}
                           </span>
                         </div>
                         <p className={cn("text-sm", !notification.read ? "text-muted-foreground" : "text-muted-foreground/70")}>
                           {notification.description}
                         </p>
                         {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                           <div className="mt-2 flex flex-wrap gap-2">
                             {Object.entries(notification.metadata).map(([key, value]) => {
                               if (key === '_id' || key === 'original_notif_id') return null; // skip noisy internal IDs
                               return (
                                 <span key={key} className="px-2 py-0.5 bg-background shadow-sm rounded border border-border/50 text-[10px] font-mono text-muted-foreground capitalize">
                                   <span className="font-semibold">{key.replace(/_/g, ' ')}:</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                 </span>
                               );
                             })}
                           </div>
                         )}
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                        {!notification.read && (
                           <Button
                             variant="ghost"
                             size="icon"
                             onClick={() => markRead(notification._id, false)}
                             className="h-8 w-8 text-muted-foreground hover:text-foreground"
                           >
                             <Check className="h-4 w-4" />
                           </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => dismiss(notification._id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
