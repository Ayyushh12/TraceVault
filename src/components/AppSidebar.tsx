import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/use-api';
import { useUIStore } from '@/store/uiStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileSearch,
  Upload,
  CheckCircle2,
  Link2,
  FolderOpen,
  Users,
  LogOut,
  Fingerprint,
  FileText,
  Settings,
  Clock,
  PanelLeftClose,
  PanelLeftOpen,
  AlertCircle,
  Network,
  Activity,
  Crown,
  ScrollText,
  Hash,
  GitMerge,
  Microscope,
  BookOpen,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const macEase = [0.28, 0.11, 0.32, 1] as const;

// Ultra-premium spring for sidebar width and position transitions
const springConfig = {
  type: 'spring' as const,
  stiffness: 180,  // Slightly softer for more natural momentum
  damping: 24,    // Perfectly balanced for zero overshoot
  mass: 0.8       // Lighter feel for agility
};

// Even softer spring for opacity/text transitions to feel more "airy"
const fadeSpring = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 28,
  mass: 1
};

const navVariants = {
  expanded: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { ...fadeSpring, delay: 0.05 } // Slight delay to let width lead
  },
  collapsed: {
    opacity: 0,
    x: -12,
    filter: 'blur(4px)',
    transition: fadeSpring
  }
};

interface NavItem {
  title: string;
  path: string;
  icon: typeof LayoutDashboard;
  roles?: string[];
}

const mainNav: NavItem[] = [
  { title: 'Dashboard',         path: '/dashboard', icon: LayoutDashboard },
  { title: 'Evidence Manager',  path: '/evidence',  icon: FileSearch },
  { title: 'Upload Evidence',   path: '/upload',    icon: Upload, roles: ['admin', 'investigator'] },
  { title: 'Verification',      path: '/verify',    icon: CheckCircle2 },
  { title: 'Chain of Custody',  path: '/custody',   icon: Link2 },
  { title: 'Case Management',   path: '/cases',     icon: FolderOpen, roles: ['admin', 'investigator'] },
  { title: 'Evidence Timeline', path: '/timeline',  icon: Clock },
  { title: 'Relationship Graph',path: '/graph',     icon: Network, roles: ['admin', 'investigator'] },
];

const secondaryNav: NavItem[] = [
  { title: 'Reports',          path: '/reports',      icon: ScrollText,  roles: ['admin', 'investigator', 'auditor'] },
  { title: 'Audit Logs',       path: '/audit-logs',   icon: FileText,    roles: ['admin', 'auditor'] },
  { title: 'Activity Tracking',path: '/activity',     icon: Activity,    roles: ['admin', 'investigator'] },
  { title: 'Risk Intelligence',path: '/threat-intel', icon: AlertCircle, roles: ['admin', 'investigator', 'auditor'] },
  { title: 'Team Management',  path: '/admin',        icon: Users,       roles: ['admin'] },
];

const canSee = (item: NavItem, userRole: string) => {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.includes(userRole);
};

interface NavButtonProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const NavButton = ({ item, active, collapsed, onClick }: NavButtonProps) => {
  return (
    <button
      onClick={onClick}
      title={item.title}
      aria-label={item.title}
      className={cn(
        'group relative flex w-full items-center rounded-lg text-[12.5px] outline-none select-none overflow-hidden',
        collapsed
          ? 'justify-center h-9 w-9 mx-auto'
          : 'gap-3 px-2.5 py-[8px]',
        active
          ? 'text-foreground font-semibold'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground font-medium'
      )}
    >
      {/* Active pill background - No AnimatePresence needed for layoutId sliding */}
      {active && (
        <motion.div
          layoutId="nav-pill"
          className="absolute inset-0 rounded-lg bg-sidebar-accent border border-border/30"
          initial={false}
          transition={springConfig}
        />
      )}

      {/* Left indicator bar — expanded only */}
      <AnimatePresence>
        {active && !collapsed && (
          <motion.div
            className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-full bg-primary z-10 shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={springConfig}
          />
        )}
      </AnimatePresence>

      {/* Collapsed: center dot below icon */}
      <AnimatePresence mode="wait">
        {active && collapsed && (
          <motion.div
            className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary z-10 shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={springConfig}
          />
        )}
      </AnimatePresence>

      <item.icon
        className={cn(
          'shrink-0 z-10 relative transition-transform duration-200',
          collapsed ? 'h-[18px] w-[18px]' : 'h-[14px] w-[14px]',
          active
            ? 'text-primary'
            : 'text-muted-foreground/70 group-hover:text-foreground'
        )}
        strokeWidth={active ? 2.2 : 1.6}
      />
      
      <AnimatePresence>
        {!collapsed && (
          <motion.span 
            className="truncate z-10 tracking-tight relative leading-tight whitespace-nowrap overflow-hidden"
            variants={navVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
          >
            {item.title}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};

const SidebarContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const isMobile = useIsMobile();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => navigate('/login'),
    });
  };

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) useUIStore.getState().setSidebarCollapsed(true);
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const collapsed = !isMobile && sidebarCollapsed;
  const userRole = (user?.role || '').toLowerCase().trim();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={cn(
        'flex items-center border-b border-sidebar-border shrink-0 h-[60px]',
        collapsed ? 'justify-center px-0' : 'gap-3 px-5'
      )}>
        <motion.div 
          layout
          className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20"
        >
          <Fingerprint className="h-[16px] w-[16px] text-primary" strokeWidth={1.8} />
        </motion.div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              layout="position"
              className="flex flex-col flex-1 truncate whitespace-nowrap overflow-hidden"
              variants={navVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
            >
              <span className="text-[13px] font-bold text-foreground tracking-tight leading-tight">
                TraceVault
              </span>
              <span className="text-[9px] text-muted-foreground/60 font-semibold tracking-[0.07em] uppercase leading-tight mt-0.5">
                Evidence Platform
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-4 sidebar-scroll">
        <div className="space-y-0.5">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.p
                layout="position"
                className="px-2.5 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground/35 whitespace-nowrap overflow-hidden"
                variants={navVariants}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
              >
                Main
              </motion.p>
            )}
          </AnimatePresence>
          {collapsed && <div className="h-1.5" />}
          {mainNav.filter(item => canSee(item, userRole)).map((item) => (
            <NavButton 
              key={item.path} 
              item={item} 
              active={isActive(item.path)} 
              collapsed={collapsed}
              onClick={() => handleNav(item.path)}
            />
          ))}
        </div>

        <div className="space-y-0.5">
          {!collapsed && <div className="h-px bg-border/20 mx-1 mb-2" />}
          {collapsed && <div className="h-px bg-border/15 mx-1.5 mb-1.5" />}
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.p
                layout="position"
                className="px-2.5 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground/35 whitespace-nowrap overflow-hidden"
                variants={navVariants}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
              >
                Intelligence
              </motion.p>
            )}
          </AnimatePresence>
          {secondaryNav.filter(item => canSee(item, userRole)).map((item) => (
            <NavButton 
              key={item.path} 
              item={item} 
              active={isActive(item.path)} 
              collapsed={collapsed}
              onClick={() => handleNav(item.path)}
            />
          ))}
          <NavButton 
            item={{ title: 'Settings', path: '/settings', icon: Settings }} 
            active={isActive('/settings')}
            collapsed={collapsed}
            onClick={() => handleNav('/settings')}
          />
        </div>
      </nav>

      {/* Footer */}
      <div className={cn(
        'border-t border-sidebar-border px-3 py-3 space-y-1 flex flex-col',
        collapsed ? 'items-center px-1' : ''
      )}>
        {!isMobile && (
          <button
            onClick={toggleSidebar}
            className={cn(
              'flex items-center rounded-lg text-muted-foreground/60 transition-all duration-300 outline-none w-full overflow-hidden',
              collapsed
                ? 'justify-center h-10 w-10 hover:bg-muted/40 hover:text-foreground'
                : 'gap-3.5 px-3 py-[9px] hover:bg-muted/30 hover:text-foreground'
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div className="flex items-center justify-center shrink-0">
              {collapsed ? (
                <PanelLeftOpen className="h-[16px] w-[16px]" strokeWidth={1.6} />
              ) : (
                <PanelLeftClose className="h-[16px] w-[16px]" strokeWidth={1.6} />
              )}
            </div>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  layout="position"
                  className="text-[12px] font-medium tracking-tight whitespace-nowrap"
                  variants={navVariants}
                  initial="collapsed"
                  animate="expanded"
                  exit="collapsed"
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center rounded-lg text-[12.5px] text-destructive/60 transition-all duration-300 outline-none w-full overflow-hidden',
            collapsed
              ? 'justify-center h-9 w-9 hover:bg-destructive/8 hover:text-destructive'
              : 'gap-2.5 px-2.5 py-[8px] hover:bg-destructive/6 hover:text-destructive font-medium'
          )}
          title="Sign out"
        >
          <LogOut className={cn('shrink-0', collapsed ? 'h-[16px] w-[16px]' : 'h-[14px] w-[14px]')} strokeWidth={1.6} />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                layout="position"
                className="whitespace-nowrap"
                variants={navVariants}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
};

const AppSidebar = () => {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={!sidebarCollapsed} onOpenChange={(open) => setSidebarCollapsed(!open)}>
        <SheetContent side="left" className="w-[256px] p-0 bg-sidebar border-sidebar-border">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 260 }}
      transition={springConfig}
      className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border overflow-hidden shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-30"
    >
      <SidebarContent />
    </motion.aside>
  );
};

export default AppSidebar;
