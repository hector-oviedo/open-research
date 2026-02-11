/**
 * MissionControl - Main Dashboard Page
 *
 * Workspace + dedicated result screen split.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Cpu, Terminal } from 'lucide-react';
import { AgentStatus } from '../components/AgentStatus';
import { Header } from '../components/Header';
import { ProgressTracker } from '../components/ProgressTracker';
import { ResearchInput } from '../components/ResearchInput';
import { SessionDrawer } from '../components/SessionDrawer';
import { SettingsModal } from '../components/SettingsModal';
import { TraceLog } from '../components/TraceLog';
import { useTheme } from '../hooks/useTheme';
import { useAgentStream } from '../hooks/useAgentStream';
import { useResearchStore } from '../stores/researchStore';

const ResultScreen = lazy(async () => {
  const module = await import('./ResultScreen');
  return { default: module.ResultScreen };
});

export function MissionControl() {
  const {
    status,
    finalReport,
    viewMode,
    setViewMode,
    researchOptions,
    setResearchOptions,
    resumeResearch,
    reset,
  } = useResearchStore();

  const [isConnected, setIsConnected] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const manualResetRef = useRef(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { connect, disconnect } = useAgentStream();
  const isRunning = status === 'running';
  const hasResult = status === 'completed' && finalReport;

  useEffect(() => {
    const checkConnection = () => {
      fetch('/api/status', { method: 'GET' })
        .then((response) => setIsConnected(response.ok))
        .catch(() => setIsConnected(false));
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resumeLatestRunningSession = async () => {
      const current = useResearchStore.getState();
      if (current.status !== 'idle' || current.sessionId) {
        return;
      }

      try {
        const sessionsResponse = await fetch('/api/research/sessions');
        const sessionsPayload = await sessionsResponse.json();
        const sessions: Array<{ session_id: string; status: string; query?: string }> =
          Array.isArray(sessionsPayload.sessions) ? sessionsPayload.sessions : [];
        const runningSession = sessions.find((session) => session.status === 'running');
        if (!runningSession || cancelled || manualResetRef.current) {
          return;
        }

        const statusResponse = await fetch(`/api/research/${runningSession.session_id}/status`);
        const statusPayload = await statusResponse.json();
        if (cancelled || manualResetRef.current || statusPayload.status !== 'running') {
          return;
        }

        const latest = useResearchStore.getState();
        if (latest.status !== 'idle' || latest.sessionId || manualResetRef.current) {
          return;
        }

        const resumedQuery = String(statusPayload.query ?? runningSession.query ?? '');
        resumeResearch(runningSession.session_id, resumedQuery);
        setViewMode('workspace');
        connect(runningSession.session_id);
      } catch (error) {
        console.error('Failed to auto-resume running session:', error);
      }
    };

    void resumeLatestRunningSession();
    return () => {
      cancelled = true;
    };
  }, [connect, resumeResearch, setViewMode]);

  const openResultScreen = () => {
    setIsSessionsOpen(false);
    setViewMode('result');
  };

  const openWorkspaceScreen = () => {
    setIsSessionsOpen(false);
    setViewMode('workspace');
  };

  const handleLogoClick = () => {
    manualResetRef.current = true;
    disconnect();
    reset();
    setViewMode('workspace');
    setIsSessionsOpen(false);
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Header
        isConnected={isConnected}
        onSessionsClick={() => setIsSessionsOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        theme={theme}
        resolvedTheme={resolvedTheme}
        onThemeChange={setTheme}
        onLogoClick={handleLogoClick}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={setResearchOptions}
        initialSettings={researchOptions}
      />
      <SessionDrawer
        isOpen={isSessionsOpen}
        onClose={() => setIsSessionsOpen(false)}
        onViewReport={openResultScreen}
        onOpenWorkspace={openWorkspaceScreen}
      />

      {viewMode === 'result' && hasResult ? (
        <Suspense
          fallback={
            <div className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center px-4 text-[hsl(var(--muted-foreground))]">
              Loading report screen...
            </div>
          }
        >
          <ResultScreen onBack={() => setViewMode('workspace')} />
        </Suspense>
      ) : (
        <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 space-y-3 sm:mb-6 sm:space-y-4"
          >
            <ResearchInput />
            <ProgressTracker />
          </motion.section>

          <section className="glass flex max-h-[56vh] min-h-[360px] flex-col overflow-hidden rounded-xl sm:max-h-[62vh] sm:min-h-[420px] lg:max-h-[min(72vh,760px)] lg:min-h-[560px]">
            <div className="grid grid-cols-[minmax(92px,22%)_minmax(0,1fr)] border-b border-[hsl(var(--border)/0.7)] md:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]">
              <header className="border-r border-[hsl(var(--border)/0.7)] px-2 py-2.5 sm:px-4 sm:py-3">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] sm:text-base">Agent Pipeline</h3>
                <p className="hidden text-xs text-[hsl(var(--muted-foreground))] sm:block">Multi-agent orchestration status</p>
              </header>
              <header className="px-2 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] sm:text-base">Event Log</h3>
                    <p className="hidden text-xs text-[hsl(var(--muted-foreground))] sm:block">Real-time research events</p>
                  </div>
                  {isRunning ? (
                    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--primary))] sm:text-sm">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                      <span className="hidden sm:inline">Live</span>
                    </div>
                  ) : null}
                </div>
              </header>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[minmax(92px,22%)_minmax(0,1fr)] md:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-y-auto border-r border-[hsl(var(--border)/0.7)] p-2 sm:p-3 lg:p-4">
                <AgentStatus showTitle={false} />
              </aside>
              <section className="min-h-0 p-2 sm:p-3 lg:p-4">
                <TraceLog onViewReport={openResultScreen} showHeader={false} />
              </section>
            </div>
          </section>

          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 border-t border-[hsl(var(--border)/0.65)] pt-8"
          >
            <div className="flex flex-wrap justify-center gap-8">
              <div className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                <Terminal className="h-5 w-5" />
                <div>
                  <p className="font-medium text-[hsl(var(--foreground))]">Backend</p>
                  <p>FastAPI + LangGraph</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                <Cpu className="h-5 w-5" />
                <div>
                  <p className="font-medium text-[hsl(var(--foreground))]">Inference</p>
                  <p>gpt-oss:20b ROCm</p>
                </div>
              </div>
              <a
                href="http://localhost:8000/custom-docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--primary))]"
              >
                <BookOpen className="h-5 w-5" />
                <div>
                  <p className="font-medium text-[hsl(var(--foreground))]">Documentation</p>
                  <p>API Reference</p>
                </div>
              </a>
            </div>
          </motion.footer>
        </main>
      )}
    </div>
  );
}
