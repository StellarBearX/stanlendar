import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useErrorToast, useSuccessToast } from '../components/common/Toast';

export interface OptimisticUpdate<T> {
  id: string;
  data: T;
  timestamp: number;
  rollback: () => void;
}

export interface UseOptimisticUpdatesOptions<T> {
  queryKey: string[];
  updateFn: (oldData: T[] | undefined, newItem: T) => T[];
  rollbackFn: (oldData: T[] | undefined, itemId: string) => T[];
  successMessage?: string;
  errorMessage?: string;
}

export function useOptimisticUpdates<T extends { id: string }>({
  queryKey,
  updateFn,
  rollbackFn,
  successMessage,
  errorMessage,
}: UseOptimisticUpdatesOptions<T>) {
  const queryClient = useQueryClient();
  const [pendingUpdates, setPendingUpdates] = useState<OptimisticUpdate<T>[]>([]);
  const updateTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const successToast = useSuccessToast();
  const errorToast = useErrorToast();

  const addOptimisticUpdate = useCallback(
    async (
      newItem: T,
      mutationFn: () => Promise<T>,
      options?: {
        timeout?: number;
        onSuccess?: (data: T) => void;
        onError?: (error: Error) => void;
      }
    ) => {
      const updateId = `update_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const timeout = options?.timeout ?? 10000; // 10 second timeout

      // Create rollback function
      const rollback = () => {
        queryClient.setQueryData(queryKey, (oldData: T[] | undefined) =>
          rollbackFn(oldData, updateId)
        );
        setPendingUpdates(prev => prev.filter(update => update.id !== updateId));
        
        // Clear timeout
        const timeoutId = updateTimeoutRef.current.get(updateId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          updateTimeoutRef.current.delete(updateId);
        }
      };

      // Add optimistic update
      const optimisticUpdate: OptimisticUpdate<T> = {
        id: updateId,
        data: { ...newItem, id: updateId },
        timestamp: Date.now(),
        rollback,
      };

      // Update query cache optimistically
      queryClient.setQueryData(queryKey, (oldData: T[] | undefined) =>
        updateFn(oldData, optimisticUpdate.data)
      );

      // Track pending update
      setPendingUpdates(prev => [...prev, optimisticUpdate]);

      // Set timeout for automatic rollback
      const timeoutId = setTimeout(() => {
        rollback();
        errorToast(
          'Operation Timeout',
          'The operation took too long and was cancelled. Please try again.'
        );
      }, timeout);
      updateTimeoutRef.current.set(updateId, timeoutId);

      try {
        // Perform actual mutation
        const result = await mutationFn();

        // Success: replace optimistic data with real data
        queryClient.setQueryData(queryKey, (oldData: T[] | undefined) => {
          if (!oldData) return [result];
          return oldData.map(item => 
            item.id === updateId ? result : item
          );
        });

        // Remove from pending updates
        setPendingUpdates(prev => prev.filter(update => update.id !== updateId));
        
        // Clear timeout
        const timeoutId = updateTimeoutRef.current.get(updateId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          updateTimeoutRef.current.delete(updateId);
        }

        // Show success message
        if (successMessage) {
          successToast(successMessage);
        }

        // Call success callback
        options?.onSuccess?.(result);

        return result;
      } catch (error) {
        // Error: rollback optimistic update
        rollback();
        
        const errorMsg = error instanceof Error ? error.message : 'An error occurred';
        errorToast(
          errorMessage || 'Operation Failed',
          errorMsg,
          {
            label: 'Retry',
            onClick: () => addOptimisticUpdate(newItem, mutationFn, options),
          }
        );

        // Call error callback
        options?.onError?.(error as Error);

        throw error;
      }
    },
    [queryKey, updateFn, rollbackFn, queryClient, successMessage, errorMessage, successToast, errorToast]
  );

  const updateOptimisticItem = useCallback(
    async (
      itemId: string,
      updates: Partial<T>,
      mutationFn: () => Promise<T>,
      options?: {
        timeout?: number;
        onSuccess?: (data: T) => void;
        onError?: (error: Error) => void;
      }
    ) => {
      const updateId = `update_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const timeout = options?.timeout ?? 10000;

      // Store original data for rollback
      const originalData = queryClient.getQueryData<T[]>(queryKey);
      const originalItem = originalData?.find(item => item.id === itemId);

      if (!originalItem) {
        throw new Error('Item not found for update');
      }

      const rollback = () => {
        queryClient.setQueryData(queryKey, (oldData: T[] | undefined) => {
          if (!oldData) return [];
          return oldData.map(item => 
            item.id === itemId ? originalItem : item
          );
        });
        setPendingUpdates(prev => prev.filter(update => update.id !== updateId));
        
        const timeoutId = updateTimeoutRef.current.get(updateId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          updateTimeoutRef.current.delete(updateId);
        }
      };

      // Apply optimistic update
      const optimisticItem = { ...originalItem, ...updates };
      queryClient.setQueryData(queryKey, (oldData: T[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(item => 
          item.id === itemId ? optimisticItem : item
        );
      });

      // Track pending update
      const optimisticUpdate: OptimisticUpdate<T> = {
        id: updateId,
        data: optimisticItem,
        timestamp: Date.now(),
        rollback,
      };
      setPendingUpdates(prev => [...prev, optimisticUpdate]);

      // Set timeout
      const timeoutId = setTimeout(() => {
        rollback();
        errorToast(
          'Update Timeout',
          'The update took too long and was cancelled. Please try again.'
        );
      }, timeout);
      updateTimeoutRef.current.set(updateId, timeoutId);

      try {
        const result = await mutationFn();

        // Replace with real data
        queryClient.setQueryData(queryKey, (oldData: T[] | undefined) => {
          if (!oldData) return [result];
          return oldData.map(item => 
            item.id === itemId ? result : item
          );
        });

        setPendingUpdates(prev => prev.filter(update => update.id !== updateId));
        
        const timeoutId = updateTimeoutRef.current.get(updateId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          updateTimeoutRef.current.delete(updateId);
        }

        if (successMessage) {
          successToast(successMessage);
        }

        options?.onSuccess?.(result);
        return result;
      } catch (error) {
        rollback();
        
        const errorMsg = error instanceof Error ? error.message : 'An error occurred';
        errorToast(
          errorMessage || 'Update Failed',
          errorMsg,
          {
            label: 'Retry',
            onClick: () => updateOptimisticItem(itemId, updates, mutationFn, options),
          }
        );

        options?.onError?.(error as Error);
        throw error;
      }
    },
    [queryKey, queryClient, successMessage, errorMessage, successToast, errorToast]
  );

  const removeOptimisticItem = useCallback(
    async (
      itemId: string,
      mutationFn: () => Promise<void>,
      options?: {
        timeout?: number;
        onSuccess?: () => void;
        onError?: (error: Error) => void;
      }
    ) => {
      const updateId = `remove_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const timeout = options?.timeout ?? 10000;

      // Store original data for rollback
      const originalData = queryClient.getQueryData<T[]>(queryKey);
      const itemToRemove = originalData?.find(item => item.id === itemId);

      if (!itemToRemove) {
        throw new Error('Item not found for removal');
      }

      const rollback = () => {
        queryClient.setQueryData(queryKey, (oldData: T[] | undefined) => {
          if (!oldData) return [itemToRemove];
          return [...oldData, itemToRemove];
        });
        setPendingUpdates(prev => prev.filter(update => update.id !== updateId));
        
        const timeoutId = updateTimeoutRef.current.get(updateId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          updateTimeoutRef.current.delete(updateId);
        }
      };

      // Remove optimistically
      queryClient.setQueryData(queryKey, (oldData: T[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter(item => item.id !== itemId);
      });

      // Track pending update
      const optimisticUpdate: OptimisticUpdate<T> = {
        id: updateId,
        data: itemToRemove,
        timestamp: Date.now(),
        rollback,
      };
      setPendingUpdates(prev => [...prev, optimisticUpdate]);

      // Set timeout
      const timeoutId = setTimeout(() => {
        rollback();
        errorToast(
          'Removal Timeout',
          'The removal took too long and was cancelled. Please try again.'
        );
      }, timeout);
      updateTimeoutRef.current.set(updateId, timeoutId);

      try {
        await mutationFn();

        setPendingUpdates(prev => prev.filter(update => update.id !== updateId));
        
        const timeoutId = updateTimeoutRef.current.get(updateId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          updateTimeoutRef.current.delete(updateId);
        }

        if (successMessage) {
          successToast(successMessage);
        }

        options?.onSuccess?.();
      } catch (error) {
        rollback();
        
        const errorMsg = error instanceof Error ? error.message : 'An error occurred';
        errorToast(
          errorMessage || 'Removal Failed',
          errorMsg,
          {
            label: 'Retry',
            onClick: () => removeOptimisticItem(itemId, mutationFn, options),
          }
        );

        options?.onError?.(error as Error);
        throw error;
      }
    },
    [queryKey, queryClient, successMessage, errorMessage, successToast, errorToast]
  );

  const clearPendingUpdates = useCallback(() => {
    // Rollback all pending updates
    pendingUpdates.forEach(update => update.rollback());
    setPendingUpdates([]);
    
    // Clear all timeouts
    updateTimeoutRef.current.forEach(timeoutId => clearTimeout(timeoutId));
    updateTimeoutRef.current.clear();
  }, [pendingUpdates]);

  return {
    pendingUpdates,
    addOptimisticUpdate,
    updateOptimisticItem,
    removeOptimisticItem,
    clearPendingUpdates,
  };
}