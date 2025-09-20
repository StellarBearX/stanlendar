import { useState, useCallback, useRef } from 'react';
import { useErrorToast } from '../components/common/Toast';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number, error: Error) => void;
  onMaxAttemptsReached?: (error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryState {
  isRetrying: boolean;
  attempt: number;
  lastError?: Error;
  nextRetryIn?: number;
}

export function useRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry,
    onMaxAttemptsReached,
    shouldRetry = () => true,
  } = options;

  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const errorToast = useErrorToast();

  const calculateDelay = useCallback((attempt: number) => {
    const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }, [baseDelay, backoffFactor, maxDelay]);

  const executeWithRetry = useCallback(async (): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setRetryState({
          isRetrying: attempt > 1,
          attempt,
          lastError: undefined,
        });

        const result = await operation();
        
        // Success - reset state
        setRetryState({
          isRetrying: false,
          attempt: 0,
        });
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        setRetryState({
          isRetrying: true,
          attempt,
          lastError,
        });

        // Check if we should retry this error
        if (!shouldRetry(lastError)) {
          throw lastError;
        }

        // If this was the last attempt, don't wait
        if (attempt === maxAttempts) {
          break;
        }

        // Calculate delay and wait
        const delay = calculateDelay(attempt);
        
        // Update state with countdown
        let remainingTime = Math.ceil(delay / 1000);
        setRetryState(prev => ({
          ...prev,
          nextRetryIn: remainingTime,
        }));

        // Countdown timer
        const countdownInterval = setInterval(() => {
          remainingTime--;
          if (remainingTime <= 0) {
            clearInterval(countdownInterval);
            setRetryState(prev => ({
              ...prev,
              nextRetryIn: undefined,
            }));
          } else {
            setRetryState(prev => ({
              ...prev,
              nextRetryIn: remainingTime,
            }));
          }
        }, 1000);

        // Wait for the delay
        await new Promise(resolve => {
          retryTimeoutRef.current = setTimeout(() => {
            clearInterval(countdownInterval);
            resolve(void 0);
          }, delay);
        });

        // Call retry callback
        onRetry?.(attempt, lastError);
      }
    }

    // All attempts failed
    setRetryState({
      isRetrying: false,
      attempt: maxAttempts,
      lastError,
    });

    onMaxAttemptsReached?.(lastError);
    throw lastError;
  }, [operation, maxAttempts, calculateDelay, shouldRetry, onRetry, onMaxAttemptsReached]);

  const retry = useCallback(async () => {
    try {
      return await executeWithRetry();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Operation failed';
      errorToast(
        'Operation Failed',
        `Failed after ${maxAttempts} attempts: ${errorMsg}`,
        {
          label: 'Try Again',
          onClick: retry,
        }
      );
      throw error;
    }
  }, [executeWithRetry, maxAttempts, errorToast]);

  const cancel = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
    
    setRetryState({
      isRetrying: false,
      attempt: 0,
    });
  }, []);

  return {
    retry,
    cancel,
    retryState,
    executeWithRetry,
  };
}

// Hook for retrying failed queries
export function useQueryRetry() {
  const errorToast = useErrorToast();

  const retryQuery = useCallback(async (
    queryFn: () => Promise<any>,
    queryKey: string,
    options: RetryOptions = {}
  ) => {
    const { retry } = useRetry(queryFn, {
      maxAttempts: 3,
      baseDelay: 2000,
      shouldRetry: (error) => {
        // Don't retry on authentication errors
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          return false;
        }
        // Don't retry on validation errors
        if (error.message.includes('400') || error.message.includes('422')) {
          return false;
        }
        return true;
      },
      onMaxAttemptsReached: (error) => {
        errorToast(
          'Query Failed',
          `Unable to load ${queryKey}: ${error.message}`,
          {
            label: 'Retry',
            onClick: () => retryQuery(queryFn, queryKey, options),
          }
        );
      },
      ...options,
    });

    return retry();
  }, [errorToast]);

  return { retryQuery };
}

// Hook for retrying mutations with exponential backoff
export function useMutationRetry() {
  const errorToast = useErrorToast();

  const retryMutation = useCallback(async (
    mutationFn: () => Promise<any>,
    operationName: string,
    options: RetryOptions = {}
  ) => {
    const { retry } = useRetry(mutationFn, {
      maxAttempts: 3,
      baseDelay: 1000,
      shouldRetry: (error) => {
        // Retry on network errors and server errors
        if (error.message.includes('fetch') || 
            error.message.includes('500') || 
            error.message.includes('502') || 
            error.message.includes('503')) {
          return true;
        }
        return false;
      },
      onRetry: (attempt, error) => {
        errorToast(
          `${operationName} Failed`,
          `Attempt ${attempt} failed: ${error.message}. Retrying...`,
          { duration: 3000 }
        );
      },
      onMaxAttemptsReached: (error) => {
        errorToast(
          `${operationName} Failed`,
          `Operation failed after multiple attempts: ${error.message}`,
          {
            label: 'Try Again',
            onClick: () => retryMutation(mutationFn, operationName, options),
          }
        );
      },
      ...options,
    });

    return retry();
  }, [errorToast]);

  return { retryMutation };
}