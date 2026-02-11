/**
 * ResearchInput - Feature Component
 * 
 * Input form for starting new research with integrated action buttons.
 * ChatGPT-style interface with buttons inside the input.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Play, Square } from 'lucide-react';
import { useResearch } from '../hooks/useResearch';
import { useAgentStream } from '../hooks/useAgentStream';
import { useResearchStore } from '../stores/researchStore';

interface ResearchInputProps {
  compact?: boolean;
}

export function ResearchInput({ compact = false }: ResearchInputProps) {
  const [localQuery, setLocalQuery] = useState('');
  const { startResearch, isLoading } = useResearch();
  const { connect, disconnect } = useAgentStream();
  const {
    status,
    sessionId,
    researchOptions,
    setQuery,
    query,
  } = useResearchStore();
  const isRunning = status === 'running';

  useEffect(() => {
    if (query && query !== localQuery) {
      setLocalQuery(query);
    }
  }, [query, localQuery]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!localQuery.trim() || isLoading || isRunning) return;

    setQuery(localQuery);

    const newSessionId = await startResearch(localQuery, researchOptions);
    if (newSessionId) {
      connect(newSessionId);
    }
  }, [localQuery, isLoading, isRunning, setQuery, startResearch, researchOptions, connect]);

  const { stopResearch } = useResearch();

  const handleStop = useCallback(async () => {
    if (sessionId) {
      await stopResearch(sessionId);
      disconnect();
    }
  }, [sessionId, stopResearch, disconnect]);

  // Keyboard shortcut: Ctrl+Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!isRunning && localQuery.trim()) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, isRunning, localQuery]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      {!compact && (
        <div className="mb-6 text-center">
          <p className="mx-auto max-w-3xl text-sm text-[hsl(var(--muted-foreground))] md:text-lg">
            Enter any topic and let our multi-agent system research it for you.
            Planner → Finder → Summarizer → Reviewer → Writer.
          </p>
        </div>
      )}

      {sessionId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-3 text-sm text-[hsl(var(--muted-foreground))]"
        >
          Session:
          {' '}
          <code className="inline-block break-all rounded bg-[hsl(var(--secondary))] px-3 py-1.5 text-sm">
            {sessionId}
          </code>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative overflow-hidden rounded-[999px] border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.82)]">
          <Search className="absolute left-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />

          <textarea
            placeholder={compact ? 'What would you like to research next?' : 'What would you like to research?'}
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            disabled={isRunning}
            rows={compact ? 2 : 1}
            className="w-full min-h-[56px] resize-none border-0 bg-transparent pl-14 pr-24 pb-4 pt-4 text-sm leading-6 md:text-base
                       text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]
                       focus:outline-none
                       transition-all duration-200
                       disabled:opacity-70 disabled:cursor-not-allowed"
          />

          {/* Action button inside input */}
          <div className="absolute inset-y-1.5 right-1.5">
            {isRunning ? (
              <button
                type="button"
                onClick={handleStop}
                className="h-full aspect-square rounded-full border border-amber-500/30 bg-amber-500/20 text-amber-400 transition-colors hover:bg-amber-500/30"
                title="Stop research"
              >
                <Square className="mx-auto h-5 w-5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!localQuery.trim() || isLoading}
                className="h-full aspect-square rounded-full bg-blue-500 text-white hover:bg-blue-600
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
                title="Start research"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Search className="mx-auto h-5 w-5" />
                  </motion.div>
                ) : (
                  <Play className="mx-auto h-5 w-5 fill-current" />
                )}
              </button>
            )}
          </div>

        </div>
      </form>
    </motion.div>
  );
}
