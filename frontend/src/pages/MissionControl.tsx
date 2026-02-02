/**
 * MissionControl - Main Dashboard Page
 * 
 * The central command interface for the Deep Research System.
 * Assembles all components into a cohesive dashboard layout.
 */
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Header } from '../components/Header';
import { ResearchInput } from '../components/ResearchInput';
import { AgentStatus } from '../components/AgentStatus';
import { ProgressTracker } from '../components/ProgressTracker';
import { TraceLog } from '../components/TraceLog';
import { ReportViewer } from '../components/ReportViewer';
import { SessionList } from '../components/SessionList';
import { Card } from '../components/ui/Card';
import { useResearchStore } from '../stores/researchStore';
import { Terminal, Cpu } from 'lucide-react';
import { SettingsModal, type ResearchSettings } from '../components/SettingsModal';

export function MissionControl() {
  const { status, finalReport } = useResearchStore();
  const [isConnected, setIsConnected] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ResearchSettings>({
    maxSources: 10,
    maxIterations: 3,
    sourceDiversity: true,
    reportLength: 'medium',
  });
  const reportRef = useRef<HTMLDivElement>(null);
  const isRunning = status === 'running';
  const isCompleted = status === 'completed';

  const scrollToReport = () => {
    reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Monitor connection status
  useEffect(() => {
    const checkConnection = () => {
      // Check if we can reach the backend
      fetch('/api/health', { method: 'HEAD' })
        .then(() => setIsConnected(true))
        .catch(() => setIsConnected(false));
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header with heartbeat indicator */}
      <Header 
        isConnected={isConnected} 
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={setSettings}
        initialSettings={settings}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Research Input Section */}
        <section className="mb-8">
          <ResearchInput />
        </section>

        {/* Progress Section */}
        {status !== 'idle' && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <ProgressTracker />
          </motion.section>
        )}

        {/* Report Section (shown when completed) */}
        {isCompleted && finalReport && (
          <motion.section
            ref={reportRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <ReportViewer />
          </motion.section>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Agent Status & Sessions */}
          <div className="space-y-6">
            <Card 
              title="Agent Pipeline" 
              subtitle="Multi-agent orchestration status"
              className="h-auto"
            >
              <AgentStatus />
            </Card>
            
            <SessionList />
          </div>

          {/* Right Column - Event Log */}
          <div className="lg:col-span-2">
            <Card 
              title="Event Log" 
              subtitle="Real-time research events"
              className="h-full min-h-[500px]"
              headerAction={
                isRunning && (
                  <div className="flex items-center gap-2 text-sm text-blue-400">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    Live
                  </div>
                )
              }
            >
              <TraceLog onViewReport={scrollToReport} />
            </Card>
          </div>
        </div>

        {/* Keyboard Shortcuts Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 pt-8 border-t border-slate-800/50"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Terminal className="w-5 h-5" />
              <div>
                <p className="font-medium text-slate-400">Backend</p>
                <p>FastAPI + LangGraph</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <Cpu className="w-5 h-5" />
              <div>
                <p className="font-medium text-slate-400">Inference</p>
                <p>gpt-oss:20b ROCm</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <div>
                <p className="font-medium text-slate-400">Connection</p>
                <p className={isConnected ? 'text-emerald-400' : 'text-red-400'}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-600">v0.1.0 • MIT License</p>
            </div>
          </div>
        </motion.footer>
      </main>
    </div>
  );
}
