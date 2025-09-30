import useSWR from 'swr';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { domainHealthService, type DomainHealth } from '@/services/domainHealthService';

const healthFetcher = async (domainId: string) => {
  console.log(`[useDomainHealth] Fetching health for domain: ${domainId}`);
  return domainHealthService.checkDomainHealth(domainId, {
    retries: 2,
    timeout: 10000,
    useCache: true
  });
};

export function useDomainHealth(domainId: string, status: string) {
  const { logError } = useErrorLogger();

  const { data: health, isLoading, error, mutate } = useSWR<DomainHealth>(
    domainId ? `domain-health-${domainId}` : null,
    () => healthFetcher(domainId),
    {
      refreshInterval: status === 'error' ? 30000 : 60000, // Adaptive polling
      errorRetryCount: 2,
      errorRetryInterval: 5000,
      dedupingInterval: 10000,
      revalidateOnFocus: false,
      onError: (error) => {
        logError(error, {
          component: 'useDomainHealth',
          action: 'health-fetch',
          domainId,
          metadata: { status }
        });
      },
      shouldRetryOnError: (error) => {
        // Don't retry on auth errors
        return !error.message.includes('401') && !error.message.includes('Authentication');
      }
    }
  );

  const refreshHealth = async () => {
    try {
      const newHealth = await domainHealthService.refreshDomainHealth(domainId);
      mutate(newHealth, false);
      return newHealth;
    } catch (error) {
      logError(error instanceof Error ? error : new Error('Failed to refresh health'), {
        component: 'useDomainHealth',
        action: 'refresh-health',
        domainId
      });
      throw error;
    }
  };

  return {
    health,
    isLoading,
    error,
    refreshHealth
  };
}