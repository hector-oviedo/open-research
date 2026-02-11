/**
 * ProgressTracker - Feature Component
 * 
 * Shows overall research progress with visual indicators.
 */
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useResearchStore } from '../stores/researchStore';
import { Clock } from 'lucide-react';

const STAGES = ['Planner', 'Finder', 'Summarizer', 'Reviewer', 'Writer', 'Completed'] as const;
const STAGE_PROGRESS_FLOOR = [8, 30, 54, 72, 90, 100] as const;

const EVENT_STAGE_INDEX: Record<string, number> = {
  research_started: 0,
  planner_running: 0,
  planner_complete: 0,
  finder_running: 1,
  finder_source: 1,
  finder_complete: 1,
  summarizer_running: 2,
  summarizer_complete: 2,
  reviewer_running: 3,
  reviewer_complete: 3,
  writer_running: 4,
  writer_complete: 4,
  research_completed: 5,
};

export function ProgressTracker() {
  const { status, progress, error, query, events, agentStatus } = useResearchStore();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'running') {
      return;
    }
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [status]);

  const startMs = useMemo(() => {
    const startEvent = events.find((event) => event.type === 'research_started') ?? events[0];
    if (!startEvent?.timestamp) {
      return null;
    }
    const parsed = Date.parse(startEvent.timestamp);
    return Number.isNaN(parsed) ? null : parsed;
  }, [events]);

  const endMs = useMemo(() => {
    if (!startMs) {
      return null;
    }
    if (status === 'running') {
      return nowMs;
    }
    const terminalEvent = [...events].reverse().find((event) =>
      ['research_completed', 'research_error', 'research_stopped'].includes(event.type),
    );
    if (!terminalEvent?.timestamp) {
      return nowMs;
    }
    const parsed = Date.parse(terminalEvent.timestamp);
    return Number.isNaN(parsed) ? nowMs : parsed;
  }, [events, nowMs, startMs, status]);

  const elapsedLabel = useMemo(() => {
    if (!startMs || !endMs || endMs <= startMs) {
      return '00:00';
    }
    const totalSeconds = Math.floor((endMs - startMs) / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [endMs, startMs]);

  const activeStageIndex = useMemo(() => {
    if (status === 'completed') {
      return 5;
    }

    const runningAgentIndex = agentStatus.findIndex((agent) => agent.status === 'running');
    if (runningAgentIndex >= 0) {
      return runningAgentIndex;
    }

    const latestStageEvent = [...events]
      .reverse()
      .find((event) => EVENT_STAGE_INDEX[event.type] !== undefined);
    if (latestStageEvent) {
      return EVENT_STAGE_INDEX[latestStageEvent.type];
    }

    return status === 'idle' ? -1 : 0;
  }, [agentStatus, events, status]);
  const shownProgress = useMemo(() => {
    if (status === 'idle') {
      return 0;
    }
    if (status === 'completed') {
      return 100;
    }
    if (status === 'running' && activeStageIndex >= 0 && activeStageIndex < STAGE_PROGRESS_FLOOR.length) {
      return Math.max(progress, STAGE_PROGRESS_FLOOR[activeStageIndex]);
    }
    return progress;
  }, [activeStageIndex, progress, status]);

  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Awaiting research query';
      case 'running':
        return 'Deep Researching';
      case 'completed':
        return 'Research completed!';
      case 'error':
        return `Error: ${error}`;
      case 'stopped':
        return 'Research stopped';
      default:
        return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="glass rounded-xl p-3 sm:p-6">
        {/* Header */}
        <div className="mb-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:mb-4">
          <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--secondary)/0.75)] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono">{elapsedLabel}</span>
          </span>
          <h3 className="truncate text-center text-sm font-medium text-[hsl(var(--foreground))] sm:text-base">
            {getStatusText()}
          </h3>
          <span className="text-lg font-bold text-[hsl(var(--foreground))] sm:text-2xl">{shownProgress}%</span>
        </div>
        {query && (
          <p className="mb-2 max-w-full truncate text-center text-xs text-[hsl(var(--muted-foreground))] sm:mb-4 sm:text-sm">
            "{query}"
          </p>
        )}

        {/* Progress bar */}
        <div className="relative h-2 rounded-full overflow-hidden bg-[hsl(var(--secondary))]">
          <motion.div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${shownProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          
          {/* Shimmer effect - travels full width */}
          {status === 'running' && (
            <motion.div
              className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </div>

        {/* Progress milestones */}
        <div className="mt-2 grid grid-cols-6 gap-1 sm:mt-3">
          {STAGES.map((stage, index) => {
            const isActive = index === activeStageIndex;
            const isDone = activeStageIndex > index;
            return (
              <span
                key={stage}
                className={`text-center text-[10px] sm:text-xs ${
                  isActive
                    ? 'font-semibold text-[hsl(var(--foreground))]'
                    : isDone
                      ? 'text-[hsl(var(--primary))]'
                      : 'text-[hsl(var(--muted-foreground))]'
                }`}
              >
                {stage}
              </span>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
