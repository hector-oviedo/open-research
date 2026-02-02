/**
 * ResearchInput - Feature Component
 * 
 * Input form for starting new research with query input.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useResearch } from '../hooks/useResearch';
import { useAgentStream } from '../hooks/useAgentStream';
import { useResearchStore } from '../stores/researchStore';

export function ResearchInput() {
  const [query, setQuery] = useState('');
  const { startResearch, isLoading } = useResearch();
  const { connect } = useAgentStream();
  const { status, sessionId } = useResearchStore();
  const isRunning = status === 'running';

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isLoading) return;

    const newSessionId = await startResearch(query);
    if (newSessionId) {
      connect(newSessionId);
    }
  }, [query, isLoading, startResearch, connect]);

  // Keyboard shortcut: Ctrl+Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!isRunning && query.trim()) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, isRunning, query]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4"
        >
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-blue-300">AI-Powered Research</span>
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="gradient-text">Deep Research</span> System
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          Enter any topic and let our multi-agent system research it for you.
          Planner → Finder → Summarizer → Reviewer → Writer.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <Input
              type="text"
              placeholder="What would you like to research? (e.g., 'Latest AI developments in healthcare')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isRunning}
              className="pl-12 h-14 text-lg"
            />
          </div>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!query.trim() || isRunning}
            size="lg"
            className="h-14 px-8"
          >
            {isRunning ? 'Researching...' : 'Start Research'}
          </Button>
        </div>
      </form>

      {sessionId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-center text-sm text-slate-500"
        >
          Session: <code className="bg-slate-800 px-2 py-1 rounded">{sessionId}</code>
        </motion.div>
      )}
    </motion.div>
  );
}
