/**
 * SessionList - Feature Component
 * 
 * Displays list of research sessions with status.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, XCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { useResearchStore } from '../stores/researchStore';

interface Session {
  session_id: string;
  query: string;
  status: string;
  created_at: string;
}

export function SessionList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const { sessionId: currentSessionId } = useResearchStore();

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/research/sessions');
      const data = await response.json();
      if (data.status === 'success') {
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'stopped':
        return <XCircle className="w-4 h-4 text-amber-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="running">Running</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'stopped':
        return <Badge variant="warning">Stopped</Badge>;
      case 'error':
        return <Badge variant="error">Error</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card title="Sessions" subtitle="Recent research sessions">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card title="Sessions" subtitle="Recent research sessions">
        <div className="text-center py-8 text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No sessions yet</p>
          <p className="text-sm">Start a research to see it here</p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Sessions"
      subtitle={`${sessions.length} recent sessions`}
      headerAction={
        <button
          onClick={fetchSessions}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      }
    >
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {sessions.map((session) => (
            <motion.div
              key={session.session_id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`
                p-3 rounded-lg border transition-all cursor-pointer
                ${session.session_id === currentSessionId 
                  ? 'bg-blue-500/10 border-blue-500/30' 
                  : 'bg-slate-800/30 border-slate-800 hover:bg-slate-800/50'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(session.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{session.query}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(session.created_at).toLocaleString()}
                  </p>
                </div>
                {getStatusBadge(session.status)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}
