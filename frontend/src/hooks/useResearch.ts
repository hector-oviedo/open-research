/**
 * useResearch - Custom hook for research operations
 * 
 * Handles API calls for starting, stopping, and monitoring research.
 */
import { useCallback, useState } from 'react';
import { useResearchStore } from '../stores/researchStore';
import type { ResearchOptions } from '../types';

interface StartResearchResponse {
  status: string;
  session_id: string;
  query: string;
}

interface UseResearchReturn {
  isLoading: boolean;
  startResearch: (query: string, options: ResearchOptions) => Promise<string | null>;
  stopResearch: (sessionId: string) => Promise<boolean>;
  fetchStatus: (sessionId: string) => Promise<unknown>;
}

export function useResearch(): UseResearchReturn {
  const [isLoading, setIsLoading] = useState(false);
  const { startResearch: startStore, setError } = useResearchStore();

  const startResearch = useCallback(async (
    query: string,
    options: ResearchOptions,
  ): Promise<string | null> => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/research/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, options }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: StartResearchResponse = await response.json();
      
      if (data.status === 'started' && data.session_id) {
        startStore(data.session_id);
        return data.session_id;
      } else {
        throw new Error('Failed to start research');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('[Research] Start failed:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [startStore, setError]);

  const stopResearch = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/research/${sessionId}/stop`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.status === 'stopped';
    } catch (err) {
      console.error('[Research] Stop failed:', err);
      return false;
    }
  }, []);

  const fetchStatus = useCallback(async (sessionId: string): Promise<unknown> => {
    try {
      const response = await fetch(`/api/research/${sessionId}/status`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (err) {
      console.error('[Research] Status fetch failed:', err);
      return null;
    }
  }, []);

  return {
    isLoading,
    startResearch,
    stopResearch,
    fetchStatus,
  };
}
