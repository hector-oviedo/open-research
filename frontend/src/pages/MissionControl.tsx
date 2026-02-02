/**
 * MissionControl - Main Dashboard Page
 * 
 * The central command interface for the Deep Research System.
 * Assembles all components into a cohesive dashboard layout.
 */
import { motion } from 'framer-motion';
import { ResearchInput } from '../components/ResearchInput';
import { AgentStatus } from '../components/AgentStatus';
import { ProgressTracker } from '../components/ProgressTracker';
import { TraceLog } from '../components/TraceLog';
import { StopButton } from '../components/StopButton';
import { ReportViewer } from '../components/ReportViewer';
import { SessionList } from '../components/SessionList';
import { Card } from '../components/ui/Card';
import { useResearchStore } from '../stores/researchStore';
import { Activity, Terminal, Cpu, Zap } from 'lucide-react';

export function MissionControl() {
  const { status, finalReport } = useResearchStore();
  const isRunning = status === 'running';
  const isCompleted = status === 'completed';

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-[#0a0a0f]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">Deep Research</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              v0.1.0
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Powered by LangGraph + Ollama</span>
            </div>
            <StopButton />
          </div>
        </div>
      </header>

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
              <TraceLog />
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
              <Activity className="w-5 h-5" />
              <div>
                <p className="font-medium text-slate-400">Status</p>
                <p className="text-emerald-400">Operational</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <kbd className="px-2 py-1 bg-slate-800 rounded text-xs">Ctrl</kbd>
              <span>+</span>
              <kbd className="px-2 py-1 bg-slate-800 rounded text-xs">Enter</kbd>
              <span className="ml-1">Start Research</span>
            </div>
          </div>
        </motion.footer>
      </main>
    </div>
  );
}
