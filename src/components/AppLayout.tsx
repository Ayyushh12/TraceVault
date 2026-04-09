import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEffect, useRef } from 'react';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

const macEase = [0.28, 0.11, 0.32, 1] as [number, number, number, number];

const AppLayout = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-background">
        <AppHeader />
        <main className="flex-1 overflow-y-auto content-scroll">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: macEase }}
            className={isMobile ? 'px-3 py-4 w-full min-w-0' : 'px-6 lg:px-10 py-6 lg:py-8 max-w-[1600px] mx-auto w-full min-w-0'}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
