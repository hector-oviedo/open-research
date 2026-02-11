/**
 * Research Store - Zustand state management
 *
 * Holds runtime session state, UI mode, and persisted research options.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentStatus, ResearchOptions, ResearchState, TraceEvent } from '../types';
import { AGENTS } from '../types';

interface ResearchStore extends ResearchState {
  setQuery: (query: string) => void;
  startResearch: (sessionId: string) => void;
  resumeResearch: (sessionId: string, query: string) => void;
  stopResearch: () => void;
  completeResearch: (finalReport?: ResearchState['finalReport']) => void;
  loadCompletedSession: (sessionId: string, query: string, finalReport: ResearchState['finalReport']) => void;
  setError: (error: string) => void;
  reset: () => void;
  setViewMode: (viewMode: 'workspace' | 'result') => void;
  setResearchOptions: (options: ResearchOptions) => void;

  agentStatus: AgentStatus[];
  setAgentRunning: (agentName: string) => void;
  setAgentCompleted: (agentName: string) => void;
  resetAgentStatus: () => void;

  events: TraceEvent[];
  addEvent: (event: TraceEvent) => void;
  clearEvents: () => void;

  progress: number;
  setProgress: (progress: number) => void;
}

export const defaultResearchOptions: ResearchOptions = {
  maxIterations: 3,
  maxSources: 12,
  maxSourcesPerQuestion: 4,
  searchResultsPerQuery: 5,
  sourceDiversity: true,
  reportLength: 'medium',
  includeSessionMemory: true,
  sessionMemoryLimit: 3,
  summarizerSourceLimit: 6,
};

const initialState: ResearchState = {
  query: '',
  plan: [],
  sources: [],
  findings: [],
  gaps: null,
  finalReport: null,
  iteration: 0,
  status: 'idle',
  error: null,
  sessionId: null,
  viewMode: 'workspace',
  researchOptions: defaultResearchOptions,
};

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      agentStatus: AGENTS.map((agent) => ({ ...agent })),
      events: [],
      progress: 0,

      setQuery: (query) => set({ query }),

      startResearch: (sessionId) =>
        set({
          ...initialState,
          sessionId,
          status: 'running',
          query: get().query,
          viewMode: 'workspace',
          researchOptions: get().researchOptions,
          agentStatus: AGENTS.map((agent) => ({ ...agent, status: 'idle' as const })),
        }),

      resumeResearch: (sessionId, query) =>
        set((state) => ({
          ...state,
          query,
          status: 'running',
          sessionId,
          viewMode: 'workspace',
          finalReport: null,
          error: null,
          agentStatus: AGENTS.map((agent) => ({ ...agent, status: 'idle' as const })),
          events: [],
          progress: 0,
        })),

      stopResearch: () =>
        set({
          status: 'stopped',
        }),

      completeResearch: (finalReport?: ResearchState['finalReport']) =>
        set((state) => ({
          status: 'completed',
          progress: 100,
          finalReport: finalReport || state.finalReport,
          viewMode: 'result',
        })),

      loadCompletedSession: (sessionId, query, finalReport) =>
        set((state) => ({
          ...state,
          sessionId,
          query,
          status: 'completed',
          progress: 100,
          finalReport,
          viewMode: 'result',
          error: null,
        })),

      setError: (error) =>
        set({
          status: 'error',
          error,
        }),

      reset: () =>
        set({
          ...initialState,
          researchOptions: get().researchOptions,
          agentStatus: AGENTS.map((agent) => ({ ...agent, status: 'idle' as const })),
          events: [],
          progress: 0,
        }),

      setViewMode: (viewMode) => set({ viewMode }),
      setResearchOptions: (researchOptions) => set({ researchOptions }),

      setAgentRunning: (agentName) =>
        set((state) => {
          const updatedAgents = state.agentStatus.map((agent) => {
            if (agent.name === agentName) {
              return { ...agent, status: 'running' as const };
            }
            if (agent.status === 'running') {
              return { ...agent, status: 'completed' as const };
            }
            return agent;
          });
          return { agentStatus: updatedAgents };
        }),

      setAgentCompleted: (agentName) =>
        set((state) => ({
          agentStatus: state.agentStatus.map((agent) =>
            agent.name === agentName ? { ...agent, status: 'completed' as const } : agent,
          ),
        })),

      resetAgentStatus: () =>
        set({
          agentStatus: AGENTS.map((agent) => ({ ...agent, status: 'idle' as const })),
        }),

      addEvent: (event) =>
        set((state) => ({
          events: [...state.events, event],
        })),

      clearEvents: () => set({ events: [] }),

      setProgress: (progress) =>
        set({
          progress: Math.min(100, Math.max(0, progress)),
        }),
    }),
    {
      name: 'research-store',
      partialize: (state) => ({
        researchOptions: state.researchOptions,
      }),
    },
  ),
);
