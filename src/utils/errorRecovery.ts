import { supabase } from '@/integrations/supabase/client';

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

// Exponential backoff retry function
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...defaultRetryOptions, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === opts.maxRetries) {
        break;
      }

      // Don't retry on non-retryable errors
      if (isNonRetryableError(lastError)) {
        break;
      }

      const delay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );

      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Check if error should not be retried
function isNonRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('401') || // Unauthorized
    message.includes('403') || // Forbidden
    message.includes('404') || // Not found
    message.includes('422') || // Unprocessable entity
    message.includes('invalid') ||
    message.includes('malformed')
  );
}

// Auto-recovery for domain status
export async function recoverDomainStatus(domainId: string): Promise<void> {
  try {
    console.log(`Attempting to recover domain status for: ${domainId}`);

    // First, try to get current domain status
    const { data: domain, error } = await supabase
      .from('domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (error || !domain) {
      throw new Error(`Domain not found: ${domainId}`);
    }

    // If domain is in error state for more than 5 minutes, attempt recovery
    const errorThreshold = 5 * 60 * 1000; // 5 minutes
    const lastCheck = new Date(domain.last_check_at || 0);
    const now = new Date();

    if (domain.status === 'error' && (now.getTime() - lastCheck.getTime()) > errorThreshold) {
      console.log(`Domain ${domain.hostname} has been in error state for more than 5 minutes, attempting recovery`);

      // Reset domain to pending state for recovery
      await supabase
        .from('domains')
        .update({
          status: 'pending',
          error_message: null,
          last_check_at: new Date().toISOString()
        })
        .eq('id', domainId);

      // Trigger auto-configuration after brief delay
      setTimeout(async () => {
        try {
          await supabase.functions.invoke('auto-configure-domain', {
            body: { domainId }
          });
        } catch (recoveryError) {
          console.error('Auto-recovery failed:', recoveryError);
        }
      }, 5000);
    }
  } catch (error) {
    console.error('Domain recovery failed:', error);
  }
}

// Batch health checks for multiple domains
export async function batchHealthCheck(domainIds: string[]): Promise<void> {
  const batchSize = 5; // Process 5 domains at a time
  
  for (let i = 0; i < domainIds.length; i += batchSize) {
    const batch = domainIds.slice(i, i + batchSize);
    
    await Promise.allSettled(
      batch.map(async (domainId) => {
        try {
          await supabase.functions.invoke('domain-health', {
            body: { id: domainId }
          });
        } catch (error) {
          console.error(`Health check failed for domain ${domainId}:`, error);
        }
      })
    );

    // Brief pause between batches
    if (i + batchSize < domainIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}