/**
 * SessionList - Feature Component
 * 
 * Displays list of research sessions with status.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  Download,
  Eye,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { useAgentStream } from '../hooks/useAgentStream';
import { useResearchStore } from '../stores/researchStore';

interface Session {
  session_id: string;
  query: string;
  status: string;
  created_at: string;
  has_report?: boolean;
}

interface SessionListProps {
  onViewReport?: () => void;
  onOpenWorkspace?: () => void;
  className?: string;
}

interface SessionDocumentSummary {
  document_id: string;
  doc_type: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'research-report';
}

function downloadTextFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildMarkdownFromReport(report: Record<string, unknown>): string {
  const title = String(report.title ?? 'Research Report');
  const executive = String(report.executive_summary ?? '');
  const sectionsRaw = Array.isArray(report.sections) ? report.sections : [];
  const sourcesRaw = Array.isArray(report.sources_used) ? report.sources_used : [];
  const wordCount = Number(report.word_count ?? 0);
  const confidence = String(report.confidence_assessment ?? '');

  const sections = sectionsRaw
    .filter((section) => section && typeof section === 'object')
    .map((section) => ({
      heading: String((section as Record<string, unknown>).heading ?? 'Untitled Section'),
      content: String((section as Record<string, unknown>).content ?? ''),
    }));

  const sources = sourcesRaw
    .filter((source) => source && typeof source === 'object')
    .map((source) => ({
      title: String((source as Record<string, unknown>).title ?? 'Untitled Source'),
      url: String((source as Record<string, unknown>).url ?? ''),
      reliability: String((source as Record<string, unknown>).reliability ?? 'unknown'),
    }));

  return `# ${title}

## Executive Summary
${executive}

## Sections
${sections.map((section) => `### ${section.heading}\n${section.content}`).join('\n\n')}

## Confidence Assessment
${confidence}

## Sources
${sources.map((source, index) => `${index + 1}. [${source.title}](${source.url}) (${source.reliability})`).join('\n')}

_Word count: ${wordCount}_`;
}

export function SessionList({ onViewReport, onOpenWorkspace, className = '' }: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingSessionId, setDownloadingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const {
    sessionId: currentSessionId,
    loadCompletedSession,
    resumeResearch,
    reset,
  } = useResearchStore();
  const { connect } = useAgentStream();

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

  const openSessionReport = async (session: Session) => {
    if (!(session.status === 'completed' && session.has_report)) return;
    try {
      const response = await fetch(`/api/research/sessions/${session.session_id}/report`);
      const data = await response.json();
      if (data.status === 'success' && data.report) {
        loadCompletedSession(session.session_id, data.query, data.report);
        onViewReport?.();
      }
    } catch (err) {
      console.error('Failed to load session report:', err);
    }
  };

  const openSession = async (session: Session) => {
    if (session.status === 'completed' && session.has_report) {
      await openSessionReport(session);
      return;
    }

    if (session.status === 'running') {
      try {
        const statusResponse = await fetch(`/api/research/${session.session_id}/status`);
        const statusPayload = await statusResponse.json();
        const resolvedStatus = String(statusPayload.status ?? session.status);
        const resolvedQuery = String(statusPayload.query ?? session.query);

        if (resolvedStatus === 'completed') {
          await openSessionReport({
            ...session,
            status: 'completed',
            query: resolvedQuery,
            has_report: true,
          });
          return;
        }

        if (resolvedStatus === 'running') {
          resumeResearch(session.session_id, resolvedQuery);
          onOpenWorkspace?.();
          connect(session.session_id);
          return;
        }
      } catch (err) {
        console.error('Failed to resume running session:', err);
      }
    }
  };

  const downloadSessionReport = async (session: Session) => {
    if (!session.has_report) return;
    setDownloadingSessionId(session.session_id);
    try {
      const docsResponse = await fetch(`/api/research/sessions/${session.session_id}/documents`);
      const docsPayload = await docsResponse.json();
      const docs: SessionDocumentSummary[] = docsPayload.documents || [];
      const markdownDoc = docs.find((doc) => doc.doc_type === 'report_markdown');
      const jsonDoc = docs.find((doc) => doc.doc_type === 'report_json');
      const baseName = `${slugify(session.query)}-${session.session_id.slice(-6)}`;

      if (markdownDoc) {
        const markdownResponse = await fetch(
          `/api/research/sessions/${session.session_id}/documents/${markdownDoc.document_id}`,
        );
        const markdownPayload = await markdownResponse.json();
        const content = String(markdownPayload.document?.content ?? '');
        if (content) {
          downloadTextFile(content, `${baseName}.md`, 'text/markdown;charset=utf-8');
          return;
        }
      }

      if (jsonDoc) {
        const jsonResponse = await fetch(
          `/api/research/sessions/${session.session_id}/documents/${jsonDoc.document_id}`,
        );
        const jsonPayload = await jsonResponse.json();
        const content = String(jsonPayload.document?.content ?? '');
        if (content) {
          downloadTextFile(content, `${baseName}.json`, 'application/json;charset=utf-8');
          return;
        }
      }

      const reportResponse = await fetch(`/api/research/sessions/${session.session_id}/report`);
      const reportPayload = await reportResponse.json();
      if (reportPayload.status === 'success' && reportPayload.report) {
        const markdown = buildMarkdownFromReport(reportPayload.report);
        downloadTextFile(markdown, `${baseName}.md`, 'text/markdown;charset=utf-8');
      }
    } catch (err) {
      console.error('Failed to download session report:', err);
    } finally {
      setDownloadingSessionId(null);
    }
  };

  const deleteSession = async (session: Session) => {
    if (!window.confirm(`Delete this session?\n\n${session.query}`)) return;

    setDeletingSessionId(session.session_id);
    try {
      const response = await fetch(`/api/research/sessions/${session.session_id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.status === 'deleted') {
        if (currentSessionId === session.session_id) {
          reset();
        }
        setSessions((prev) => prev.filter((item) => item.session_id !== session.session_id));
        return;
      }
      if (data.message) {
        window.alert(data.message);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    } finally {
      setDeletingSessionId(null);
    }
  };

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
        return <Badge variant="running" className="px-2 py-0 text-[10px]">Running</Badge>;
      case 'completed':
        return <Badge variant="success" className="px-2 py-0 text-[10px]">Completed</Badge>;
      case 'stopped':
        return <Badge variant="warning" className="px-2 py-0 text-[10px]">Stopped</Badge>;
      case 'error':
        return <Badge variant="error" className="px-2 py-0 text-[10px]">Error</Badge>;
      default:
        return <Badge className="px-2 py-0 text-[10px]">{status}</Badge>;
    }
  };

  const wrapperClass = `h-full overflow-hidden rounded-xl border border-[hsl(var(--border)/0.7)] bg-[hsl(var(--card)/0.72)] ${className}`;

  if (loading) {
    return (
      <section className={wrapperClass}>
        <header className="flex items-center justify-between border-b border-[hsl(var(--border)/0.7)] px-3 py-2">
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Sessions</h3>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Recent research sessions</p>
          </div>
        </header>
        <div className="space-y-2 p-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[hsl(var(--secondary)/0.55)]" />
          ))}
        </div>
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className={wrapperClass}>
        <header className="flex items-center justify-between border-b border-[hsl(var(--border)/0.7)] px-3 py-2">
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Sessions</h3>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Recent research sessions</p>
          </div>
        </header>
        <div className="py-6 text-center text-[hsl(var(--muted-foreground))]">
          <Clock className="mx-auto mb-2 h-6 w-6 opacity-50" />
          <p>No sessions yet</p>
          <p className="text-xs">Start a research to see it here</p>
        </div>
      </section>
    );
  }

  return (
    <section className={wrapperClass}>
      <header className="flex items-center justify-between border-b border-[hsl(var(--border)/0.7)] px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Sessions</h3>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{sessions.length} recent sessions</p>
        </div>
        <button
          onClick={fetchSessions}
          className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
          title="Refresh"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </header>
      <div className="h-full space-y-2 overflow-y-auto p-2 pr-1">
        <AnimatePresence mode="popLayout">
          {sessions.map((session) => (
            (() => {
              const isActionable = (session.status === 'completed' && session.has_report) || session.status === 'running';
              return (
            <motion.div
              key={session.session_id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={() => {
                if (!isActionable) return;
                void openSession(session);
              }}
              className={`
                rounded-lg border p-2 transition-all
                ${session.session_id === currentSessionId 
                  ? 'bg-blue-500/10 border-blue-500/30' 
                  : 'bg-[hsl(var(--card)/0.45)] border-[hsl(var(--border)/0.45)] hover:bg-[hsl(var(--card)/0.7)]'
                }
                ${session.status === 'completed' && session.has_report ? 'hover:border-emerald-500/30' : ''}
                ${isActionable ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              <div className="flex items-center gap-2">
                {getStatusIcon(session.status)}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs text-[hsl(var(--foreground))]">{session.query}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                    {new Date(session.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {getStatusBadge(session.status)}
                  {session.status === 'completed' && session.has_report && (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void openSessionReport(session);
                        }}
                        className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"
                        title="Open report"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void downloadSessionReport(session);
                        }}
                        disabled={downloadingSessionId === session.session_id}
                        className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))] disabled:opacity-50"
                        title="Download report"
                      >
                        {downloadingSessionId === session.session_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteSession(session);
                    }}
                    disabled={session.status === 'running' || deletingSessionId === session.session_id}
                    className="rounded-md p-1 text-red-500/80 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    title={session.status === 'running' ? 'Stop session before deleting' : 'Delete session'}
                  >
                    {deletingSessionId === session.session_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
              );
            })()
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
