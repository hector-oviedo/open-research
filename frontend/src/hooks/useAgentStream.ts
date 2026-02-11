/**
 * useAgentStream - Custom hook for SSE streaming
 *
 * Shared singleton EventSource so all UI entry points (input, drawer, etc.)
 * operate on one connection and one consistent state timeline.
 */
import { useCallback, useEffect, useState } from 'react';
import { useResearchStore } from '../stores/researchStore';
import type { TraceEvent } from '../types';

interface UseAgentStreamReturn {
  isConnected: boolean;
  connect: (sessionId: string) => void;
  disconnect: () => void;
}

let sharedEventSource: EventSource | null = null;
let sharedSessionId: string | null = null;
const connectionListeners = new Set<(connected: boolean) => void>();

function notifyConnection(connected: boolean): void {
  connectionListeners.forEach((listener) => listener(connected));
}

function disconnectShared(): void {
  if (sharedEventSource) {
    sharedEventSource.close();
    sharedEventSource = null;
  }
  sharedSessionId = null;
  notifyConnection(false);
  console.log('[SSE] Disconnected');
}

export function useAgentStream(): UseAgentStreamReturn {
  const [isConnected, setIsConnected] = useState(sharedEventSource !== null);

  const {
    addEvent,
    setAgentRunning,
    setAgentCompleted,
    completeResearch,
    stopResearch,
    setError,
    setProgress,
  } = useResearchStore();

  useEffect(() => {
    connectionListeners.add(setIsConnected);
    return () => {
      connectionListeners.delete(setIsConnected);
    };
  }, []);

  const setProgressFloor = useCallback(
    (value: number) => {
      const state = useResearchStore.getState();
      if (state.status === 'completed') {
        return;
      }
      setProgress(Math.max(state.progress, value));
    },
    [setProgress],
  );

  const disconnect = useCallback(() => {
    disconnectShared();
  }, []);

  const connect = useCallback((sessionId: string) => {
    if (sharedEventSource && sharedSessionId === sessionId) {
      return;
    }

    disconnectShared();

    const url = `/api/research/${sessionId}/events`;
    console.log('[SSE] Connecting to:', url);

    const eventSource = new EventSource(url);
    sharedEventSource = eventSource;
    sharedSessionId = sessionId;

    eventSource.onopen = () => {
      notifyConnection(true);
      console.log('[SSE] Connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TraceEvent;
        console.log('[SSE] Event:', data.type, data);

        if (data.type === 'done') {
          disconnectShared();
          return;
        }

        if (data.timestamp) {
          addEvent(data);
        }

        const currentStatus = useResearchStore.getState().status;
        if (
          currentStatus === 'completed' &&
          data.type !== 'research_completed' &&
          data.type !== 'heartbeat'
        ) {
          return;
        }

        switch (data.type) {
          case 'research_started':
            setAgentRunning('Planner');
            setProgressFloor(8);
            break;

          case 'planner_running':
            setAgentRunning('Planner');
            setProgressFloor(12);
            break;

          case 'planner_complete':
            setAgentCompleted('Planner');
            setAgentRunning('Finder');
            setProgressFloor(24);
            break;

          case 'finder_running':
            setAgentRunning('Finder');
            setProgressFloor(30);
            break;

          case 'finder_source':
            setProgressFloor(34);
            break;

          case 'finder_complete':
            setAgentCompleted('Finder');
            setAgentRunning('Summarizer');
            setProgressFloor(46);
            break;

          case 'summarizer_running':
            setAgentRunning('Summarizer');
            setProgressFloor(54);
            break;

          case 'summarizer_complete':
            setAgentCompleted('Summarizer');
            setAgentRunning('Reviewer');
            setProgressFloor(66);
            break;

          case 'reviewer_running':
            setAgentRunning('Reviewer');
            setProgressFloor(72);
            break;

          case 'reviewer_complete':
            setAgentCompleted('Reviewer');
            if (data.next_action === 'finish') {
              setProgressFloor(82);
            } else if (data.next_action === 'iterate') {
              setProgressFloor(76);
            }
            break;

          case 'writer_running':
            setAgentRunning('Writer');
            setProgressFloor(90);
            break;

          case 'writer_complete':
            setAgentCompleted('Writer');
            setProgressFloor(97);
            break;

          case 'research_completed':
            if (data.final_report) {
              completeResearch(data.final_report);
            } else {
              setProgress(100);
            }
            disconnectShared();
            break;

          case 'research_stopped':
            stopResearch();
            disconnectShared();
            break;

          case 'research_error':
            setError(data.error || 'Unknown error');
            disconnectShared();
            break;

          case 'heartbeat':
          case 'connected':
            break;
        }
      } catch (err) {
        console.error('[SSE] Failed to parse event:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Error:', error);
      notifyConnection(false);
    };
  }, [
    addEvent,
    completeResearch,
    setAgentCompleted,
    setAgentRunning,
    setError,
    setProgress,
    setProgressFloor,
    stopResearch,
  ]);

  return {
    isConnected,
    connect,
    disconnect,
  };
}
