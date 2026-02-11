/**
 * SessionDrawer
 *
 * Slide-out history drawer for research sessions.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { SessionList } from './SessionList';

interface SessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onViewReport?: () => void;
  onOpenWorkspace?: () => void;
}

export function SessionDrawer({ isOpen, onClose, onViewReport, onOpenWorkspace }: SessionDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
            onClick={onClose}
          />

          <motion.aside
            initial={{ x: -360, opacity: 0.98 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -360, opacity: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-[min(430px,94vw)] border-r border-[hsl(var(--border)/0.7)] bg-[hsl(var(--background)/0.95)] px-3 pb-3 pt-3"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-[hsl(var(--foreground))]">Session History</h2>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Recent research conversations</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
                title="Close history"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-[calc(100%-3.5rem)]">
              <SessionList
                className="h-full"
                onViewReport={() => {
                  onViewReport?.();
                  onClose();
                }}
                onOpenWorkspace={() => {
                  onOpenWorkspace?.();
                  onClose();
                }}
              />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
