/**
 * useAgentStream - Custom hook for SSE streaming
 * 
 * Handles Server-Sent Events connection for real-time research updates.
 * Separates business logic from UI components.
 */
import { useCallback, useRef, useState } from 'react';
import { useResearchStore } from '../stores/researchStore';
import type { TraceEvent } from '../types';

interface UseAgentStreamReturn {
  isConnected: boolean;
  connect: (sessionId: string) => void;
  disconnect: () => void;
}

export function useAgentStream(): UseAgentStreamReturn {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  const { 
    addEvent, 
    setAgentRunning, 
    setAgentCompleted,
    completeResearch, 
    stopResearch, 
    setError,
    setProgress,
  } = useResearchStore();

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      console.log('[SSE] Disconnected');
    }
  }, []);

  const connect = useCallback((sessionId: string) => {
    // Close existing connection
    disconnect();
    
    const url = `/api/research/${sessionId}/events`;
    console.log('[SSE] Connecting to:', url);
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('[SSE] Connected');
      setIsConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data: TraceEvent = JSON.parse(event.data);
        console.log('[SSE] Event:', data.type, data);
        
        // Add to event log
        addEvent(data);
        
        // Handle different event types
        switch (data.type) {
          case 'research_started':
            setAgentRunning('Planner');
            setProgress(10);
            break;
          
          case 'planner_running':
            setAgentRunning('Planner');
            break;
            
          case 'planner_complete':
            setAgentCompleted('Planner');
            setAgentRunning('Finder');
            setProgress(25);
            break;
          
          case 'finder_running':
            setAgentRunning('Finder');
            break;
          
          case 'finder_source':
            // Source discovered - just add to event log
            break;
            
          case 'finder_complete':
            setAgentCompleted('Finder');
            setAgentRunning('Summarizer');
            setProgress(50);
            break;
          
          case 'summarizer_running':
            setAgentRunning('Summarizer');
            break;
            
          case 'summarizer_complete':
            setAgentCompleted('Summarizer');
            setAgentRunning('Reviewer');
            setProgress(70);
            break;
          
          case 'reviewer_running':
            setAgentRunning('Reviewer');
            break;
            
          case 'reviewer_complete':
            setAgentCompleted('Reviewer');
            setAgentRunning('Writer');
            setProgress(85);
            break;
          
          case 'writer_running':
            setAgentRunning('Writer');
            break;
            
          case 'writer_complete':
            setAgentCompleted('Writer');
            break;
            
          case 'research_completed':
            // Transform final_report from snake_case to match frontend types
            if (data.final_report) {
              completeResearch(data.final_report);
            }
            setProgress(100);
            disconnect();
            break;
            
          case 'research_stopped':
            stopResearch();
            disconnect();
            break;
            
          case 'research_error':
            setError(data.error || 'Unknown error');
            disconnect();
            break;
            
          case 'heartbeat':
            // Keep-alive, no action needed - filtered in TraceLog
            break;
        }
      } catch (err) {
        console.error('[SSE] Failed to parse event:', err);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('[SSE] Error:', error);
      setIsConnected(false);
      // Don't set error here, let the stream try to reconnect or complete
    };
  }, [addEvent, setAgentRunning, setAgentCompleted, completeResearch, stopResearch, setError, setProgress, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
  };
}
