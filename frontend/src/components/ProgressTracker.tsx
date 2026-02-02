/**
 * ProgressTracker - Feature Component
 * 
 * Shows overall research progress with visual indicators.
 */
import { motion } from 'framer-motion';
import { useResearchStore } from '../stores/researchStore';
import { Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

export function ProgressTracker() {
  const { status, progress, error, query } = useResearchStore();

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Clock className="w-5 h-5 text-blue-400 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'stopped':
        return <XCircle className="w-5 h-5 text-amber-400" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Ready to start';
      case 'running':
        return 'Research in progress...';
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

  if (status === 'idle') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="glass rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h3 className="font-medium text-white">{getStatusText()}</h3>
              {query && (
                <p className="text-sm text-slate-500 truncate max-w-md">
                  "{query}"
                </p>
              )}
            </div>
          </div>
          <span className="text-2xl font-bold text-white">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
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
        <div className="flex justify-between mt-3 text-xs text-slate-500">
          <span>Start</span>
          <span>Plan</span>
          <span>Sources</span>
          <span>Analysis</span>
          <span>Report</span>
        </div>
      </div>
    </motion.div>
  );
}
