import { useCallback } from 'react';
import { toast } from 'sonner';

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  domainId?: string;
  vpsId?: string;
  metadata?: Record<string, any>;
}

interface ErrorDetails {
  message: string;
  code?: string;
  statusCode?: number;
  context?: ErrorContext;
  stack?: string;
}

export function useErrorLogger() {
  const logError = useCallback((error: Error | string, context?: ErrorContext) => {
    const errorDetails: ErrorDetails = {
      message: typeof error === 'string' ? error : error.message,
      context,
      stack: typeof error === 'object' && error.stack ? error.stack : undefined,
    };

    // Enhanced error details for specific error types
    if (typeof error === 'object') {
      if ('code' in error) errorDetails.code = error.code as string;
      if ('statusCode' in error) errorDetails.statusCode = error.statusCode as number;
    }

    // Log to console with context
    console.error('[ErrorLogger]', {
      timestamp: new Date().toISOString(),
      ...errorDetails,
    });

    // Log to external service in production (future implementation)
    if (import.meta.env.PROD) {
      // TODO: Send to error monitoring service
    }

    return errorDetails;
  }, []);

  const logAndToast = useCallback((
    error: Error | string, 
    context?: ErrorContext,
    options?: {
      title?: string;
      description?: string;
      action?: {
        label: string;
        onClick: () => void;
      };
    }
  ) => {
    const errorDetails = logError(error, context);
    
    const message = options?.title || 'Erro na operação';
    const description = options?.description || errorDetails.message;

    toast.error(message, {
      description,
      action: options?.action,
      duration: 6000,
    });

    return errorDetails;
  }, [logError]);

  const logWarning = useCallback((message: string, context?: ErrorContext) => {
    console.warn('[ErrorLogger]', {
      timestamp: new Date().toISOString(),
      level: 'warning',
      message,
      context,
    });

    toast.warning(message, { duration: 4000 });
  }, []);

  const logInfo = useCallback((message: string, context?: ErrorContext) => {
    console.info('[ErrorLogger]', {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
    });
  }, []);

  const logSuccess = useCallback((message: string, context?: ErrorContext) => {
    console.info('[ErrorLogger]', {
      timestamp: new Date().toISOString(),
      level: 'success',
      message,
      context,
    });

    toast.success(message, { duration: 3000 });
  }, []);

  return {
    logError,
    logAndToast,
    logWarning,
    logInfo,
    logSuccess,
  };
}