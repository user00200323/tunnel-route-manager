import useSWR from 'swr';
import { supabase } from '@/integrations/supabase/client';

interface DomainHealth {
  dnsOk: boolean;
  tunnelOk?: boolean;
  agentOk?: boolean;
  details?: Record<string, any>;
}

const healthFetcher = async (url: string) => {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};

export function useDomainHealth(domainId: string, status: string) {
  const { data: health, isLoading, error } = useSWR<DomainHealth>(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/domain-health?id=${domainId}`,
    healthFetcher,
    {
      refreshInterval: status === 'error' ? 30000 : 60000, // Adaptive polling
      errorRetryCount: 3,
      errorRetryInterval: 10000,
      dedupingInterval: 5000,
      revalidateOnFocus: false,
      shouldRetryOnError: (error) => {
        // Don't retry on auth errors
        return !error.message.includes('401') && !error.message.includes('Authentication');
      }
    }
  );

  return {
    health,
    isLoading,
    error
  };
}