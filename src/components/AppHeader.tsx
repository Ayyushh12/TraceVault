import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/use-api';
import { useUIStore } from '@/store/uiStore';
import { useTheme } from '@/components/ThemeProvider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';
import { 
  Search, Sun, Moon, Monitor, Menu, LogOut, ChevronDown, LayoutDashboard, FileSearch, Upload, ShieldCheck, GitBranch, FolderOpen, Clock, FileText, ScrollText, Users, Settings 
} from 'lucide-react';
import { useCases, useEvidenceList } from '@/hooks/use-api';
import NotificationsPanel from '@/components/NotificationsPanel';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const AppHeader = () => {
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: casesData } = useCases();
  const { data: evidenceData } = useEvidenceList();

  const caseItems = casesData?.cases || casesData?.data?.cases || (Array.isArray(casesData) ? casesData : []);
  const evidenceItems = evidenceData?.evidence || evidenceData?.data?.evidence || (Array.isArray(evidenceData) ? evidenceData : []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => navigate('/login'),
    });
  };

  const nextTheme = () => {
    const order: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const idx = order.indexOf(theme as any);
    setTheme(order[(idx + 1) % 3]);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/30 bg-background/85 backdrop-blur-xl px-4 gap-4 shrink-0 z-10 sticky top-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden shrink-0"
          onClick={() => useUIStore.getState().setSidebarCollapsed(false)}
        >
          <Menu className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <div className="relative w-full max-w-[280px] hidden md:block">
          <Button
            variant="outline"
            className={cn(
              "relative w-full justify-start text-sm text-muted-foreground sm:pr-12",
              "h-[34px] pl-8 pr-3 text-[13px] bg-muted/40 border-transparent rounded-lg hover:border-border/50 hover:bg-muted/60 transition-all shadow-none font-normal"
            )}
            onClick={() => setOpen(true)}
          >
            <span className="inline-flex items-center absolute left-2.5 top-[50%] -translate-y-[50%] pointer-events-none">
              <Search size={15} className="text-muted-foreground/50" strokeWidth={1.5} />
            </span>
            <span className="inline-flex truncate">Search workspace…</span>
            <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-[50%] hidden h-5 select-none items-center gap-1 rounded border border-border/40 bg-muted/50 px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </div>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search workspace (evidence, cases, docs)..." 
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList className="sidebar-scroll">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Platform Core">
            <CommandItem onSelect={() => runCommand(() => navigate('/dashboard'))}>
              <LayoutDashboard className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate('/evidence'))}>
              <FileSearch className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span>Evidence Manager</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate('/upload'))}>
              <Upload className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span>Upload Evidence</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate('/verify'))}>
              <ShieldCheck className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span>Verification Tools</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Module Management">
            <CommandItem onSelect={() => runCommand(() => navigate('/custody'))}>
              <GitBranch className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span>Chain of Custody</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate('/cases'))}>
              <FolderOpen className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span>Case Management</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate('/timeline'))}>
              <Clock className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span>Evidence Timeline</span>
            </CommandItem>
          </CommandGroup>
          
          {(searchQuery.length > 0 && evidenceItems.length > 0) && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Evidence Files">
                {evidenceItems
                  .filter((e: any) => e.file_name?.toLowerCase().includes(searchQuery.toLowerCase()) || e.original_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, 5)
                  .map((ev: any) => (
                  <CommandItem key={ev.evidence_id || ev._id} onSelect={() => runCommand(() => navigate(`/evidence/${ev.evidence_id || ev._id}`))}>
                    <FileSearch className="mr-2 h-4 w-4 text-primary" strokeWidth={1.5} />
                    <span>{ev.original_name || ev.file_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {(searchQuery.length > 0 && caseItems.length > 0) && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Cases">
                {caseItems
                  .filter((c: any) => c.case_name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, 5)
                  .map((c: any) => (
                  <CommandItem key={c.case_id || c._id} onSelect={() => runCommand(() => navigate(`/cases`))}>
                    <FolderOpen className="mr-2 h-4 w-4 text-primary" strokeWidth={1.5} />
                    <span>{c.case_name || c.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="System Logs & Settings">
            <CommandItem onSelect={() => runCommand(() => navigate('/reports'))}>
              <FileText className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span>System Reports</span>
              <CommandShortcut>⌘R</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate('/audit-logs'))}>
              <ScrollText className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span>Audit Logs</span>
            </CommandItem>
            {(user?.role === 'Admin' || user?.role === 'admin') && (
              <CommandItem onSelect={() => runCommand(() => navigate('/admin'))}>
                <Users className="mr-2 h-4 w-4" strokeWidth={1.5} />
                <span>Team Management</span>
              </CommandItem>
            )}
            <CommandItem onSelect={() => runCommand(() => navigate('/settings'))}>
              <Settings className="mr-2 h-4 w-4" strokeWidth={1.5} />
              <span>Platform Settings</span>
              <CommandShortcut>⌘,</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <div className="flex items-center gap-1.5 bg-muted/40 rounded-full h-[38px] px-1.5 border border-border/50 shadow-sm shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all"
          onClick={nextTheme}
          title={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-[15px] w-[15px]" strokeWidth={1.5} />
        </Button>

        <NotificationsPanel />

        <div className="w-[1px] h-[16px] bg-border/60 mx-1 hidden sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 h-[32px] rounded-full pl-1.5 pr-3 transition-all duration-200 ease-in-out outline-none focus:outline-none focus-visible:ring-0 select-none hover:bg-background/60 data-[state=open]:bg-background/90 hover:scale-[1.02] active:scale-[0.98] border border-transparent shrink-0 overflow-hidden">
              <Avatar className="!h-[22px] !w-[22px] shrink-0 shadow-sm ring-1 ring-border/20">
                <AvatarFallback className="bg-primary text-primary-foreground text-[9px] font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:flex min-w-0 flex-col justify-center">
                <p className="text-[11px] font-bold leading-none tracking-tight truncate max-w-[80px]">{user?.full_name || 'User'}</p>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block shrink-0" strokeWidth={2} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={12} className="w-56 rounded-[16px] py-1.5 px-1.5 shadow-2xl border-border/50 bg-card/95 backdrop-blur-2xl">
            <DropdownMenuLabel className="font-normal px-2 py-1.5 focus:outline-none">
              <p className="text-[13px] font-semibold">{user?.full_name}</p>
              <p className="text-[11px] text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/60" />
            <DropdownMenuItem onClick={handleLogout} className="text-[13px] gap-2 rounded-md text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default AppHeader;
