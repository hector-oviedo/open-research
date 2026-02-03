/**
 * TraceLog - Feature Component
 * 
 * Displays real-time event log from the research process.
 */
import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useResearchStore } from '../stores/researchStore';
import { SourceLink } from './SourceLink';
import { 
  Play, 
  Search, 
  FileText, 
  CheckCircle, 
  PenTool, 
  AlertCircle,
  XCircle,
  Brain,
  FileSearch,
  Link2
} from 'lucide-react';
import type { TraceEvent } from '../types';

const eventIcons: Record<string, React.ElementType> = {
  research_started: Play,
  planner_running: Brain,
  planner_complete: Brain,
  finder_running: Search,
  finder_source: Search,
  finder_complete: Search,
  summarizer_running: FileText,
  summarizer_complete: FileText,
  reviewer_running: CheckCircle,
  reviewer_complete: CheckCircle,
  writer_running: PenTool,
  writer_complete: PenTool,
  research_completed: CheckCircle,
  research_error: AlertCircle,
  research_stopped: XCircle,
  connected: Play,
};

// Agent color mapping
const AGENT_COLORS = {
  planner: '#3b82f6',    // blue-400
  finder: '#10b981',     // emerald-400
  summarizer: '#f59e0b', // amber-400
  reviewer: '#8b5cf6',   // violet-400
  writer: '#ec4899',     // pink-400
};

const eventColors: Record<string, string> = {
  research_started: 'text-blue-400',
  planner_running: 'text-blue-400',
  planner_complete: 'text-blue-400',
  finder_running: 'text-emerald-400',
  finder_source: 'text-emerald-400',
  finder_complete: 'text-emerald-400',
  summarizer_running: 'text-amber-400',
  summarizer_complete: 'text-amber-400',
  reviewer_running: 'text-violet-400',
  reviewer_complete: 'text-violet-400',
  writer_running: 'text-pink-400',
  writer_complete: 'text-pink-400',
  research_completed: 'text-emerald-400',
  research_error: 'text-red-400',
  research_stopped: 'text-amber-400',
  connected: 'text-emerald-400',
};

// Get agent color for border styling
function getAgentColor(eventType: string): string {
  if (eventType.includes('planner')) return AGENT_COLORS.planner;
  if (eventType.includes('finder')) return AGENT_COLORS.finder;
  if (eventType.includes('summarizer')) return AGENT_COLORS.summarizer;
  if (eventType.includes('reviewer')) return AGENT_COLORS.reviewer;
  if (eventType.includes('writer')) return AGENT_COLORS.writer;
  return 'transparent';
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
}

function EventItem({ event, index }: { event: TraceEvent; index: number }) {
  const Icon = eventIcons[event.type] || Play;
  const colorClass = eventColors[event.type] || 'text-slate-400';
  const agentColor = getAgentColor(event.type);
  const isRunning = event.type.includes('_running');
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-slate-800/50 transition-colors group"
      style={{ 
        borderLeft: `2px solid ${agentColor}`,
        backgroundColor: isRunning ? `${agentColor}10` : undefined 
      }}
    >
      <div className={`mt-0.5 ${colorClass} ${isRunning ? 'animate-pulse' : ''}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">
            {formatTime(event.timestamp)}
          </span>
          <span className={`text-sm font-medium ${colorClass}`}>
            {event.type.replace(/_/g, ' ')}
          </span>
          {isRunning && (
            <span 
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: agentColor }}
            />
          )}
        </div>
        {/* Display agent activity message */}
        {event.message && (
          <p className={`text-sm mt-1 ${isRunning ? 'text-slate-200' : 'text-slate-400'}`}>
            {event.message}
          </p>
        )}
        {/* Display individual finder source with link icon */}
        {event.type === 'finder_source' && event.source_url && (
          <div className="mt-2 pl-2 border-l-2 border-emerald-500/30">
            <div className="flex items-center gap-1 text-xs text-emerald-400/70 mb-1">
              <Link2 className="w-3 h-3" />
              <span>Source discovered:</span>
            </div>
            <SourceLink
              url={event.source_url}
              title={event.source_title || undefined}
              domain={event.source_domain || undefined}
              variant="card"
              size="sm"
            />
          </div>
        )}
        {/* Display URLs for finder complete event */}
        {event.urls && event.urls.length > 0 && (
          <div className="mt-2 pl-2 border-l-2 border-emerald-500/30">
            <div className="flex items-center gap-1 text-xs text-emerald-400/70 mb-1">
              <Link2 className="w-3 h-3" />
              <span>Top sources:</span>
            </div>
            <div className="space-y-1">
              {event.urls.map((url: string, idx: number) => (
                <SourceLink
                  key={idx}
                  url={url}
                  variant="inline"
                  size="sm"
                />
              ))}
            </div>
          </div>
        )}
        {/* Display questions for planner events */}
        {event.questions && event.questions.length > 0 && (
          <div className="mt-2 space-y-1">
            {event.questions.map((q: string, idx: number) => (
              <div 
                key={idx}
                className="text-xs text-blue-400/90 pl-2 border-l-2 border-blue-500/30"
              >
                {idx + 1}. {q}
              </div>
            ))}
          </div>
        )}
        {event.error && (
          <p className="text-xs text-red-400 mt-0.5">{event.error}</p>
        )}
      </div>
    </motion.div>
  );
}

interface TraceLogProps {
  onViewReport?: () => void;
}

export function TraceLog({ onViewReport }: TraceLogProps) {
  const { events, status, finalReport } = useResearchStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isCompleted = status === 'completed';

  // Filter out heartbeat events
  const displayEvents = events.filter(e => e.type !== 'heartbeat');

  // Auto-scroll to bottom only when display events change (not heartbeats)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayEvents.length]);

  if (status === 'idle' && displayEvents.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Event Log
        </h3>
        <span className="text-xs text-slate-500">{displayEvents.length} events</span>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px] space-y-2 pr-2"
      >
        <AnimatePresence mode="popLayout">
          {displayEvents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Waiting for events...
            </div>
          ) : (
            displayEvents.map((event, index) => (
              <EventItem key={`${event.timestamp}-${index}`} event={event} index={index} />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* See Report Button */}
      {isCompleted && finalReport && onViewReport && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 pt-4 border-t border-slate-800"
        >
          <button
            onClick={onViewReport}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 
                       bg-emerald-500/20 hover:bg-emerald-500/30 
                       border border-emerald-500/30 rounded-lg
                       text-emerald-400 transition-colors"
          >
            <FileSearch className="w-5 h-5" />
            <span className="font-medium">See Report</span>
            <span className="text-sm text-emerald-500/70">
              ({finalReport.word_count} words)
            </span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
