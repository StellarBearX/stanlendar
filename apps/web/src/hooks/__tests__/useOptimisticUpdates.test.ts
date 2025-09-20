import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { ToastProvider } from '../../components/common/Toast';

// Mock data
interface TestItem {
  id: string;
  name: string;
  value: number;
}

const mockItems: TestItem[] = [
  { id: '1', name: 'Item 1', value: 10 },
  { id: '2', name: 'Item 2', value: 20 },
];

// Test wrapper with providers
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
};

describe('useOptimisticUpdates', () => {
  let queryClient: QueryClient;
  const queryKey = ['test-items'];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    // Set initial data
    queryClient.setQueryData(queryKey, mockItems);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const defaultOptions = {
    queryKey,
    updateFn: (oldData: TestItem[] | undefined, newItem: TestItem) => 
      oldData ? [...oldData, newItem] : [newItem],
    rollbackFn: (oldData: TestItem[] | undefined, itemId: string) =>
      oldData ? oldData.filter(item => item.id !== itemId) : [],
    successMessage: 'Item added successfully',
    errorMessage: 'Failed to add item',
  };

  it('should add optimistic update and resolve successfully', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOptimisticUpdates(defaultOptions), { wrapper });

    const newItem: TestItem = { id: '3', name: 'Item 3', value: 30 };
    const mockMutation = jest.fn().mockResolvedValue(newItem);

    let mutationPromise: Promise<TestItem>;
    
    act(() => {
      mutationPromise = result.current.addOptimisticUpdate(newItem, mockMutation);
    });

    // Check that optimistic update was applied
    const optimisticData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(optimisticData).toHaveLength(3);
    expect(optimisticData?.[2].name).toBe('Item 3');

    // Check pending updates
    expect(result.current.pendingUpdates).toHaveLength(1);

    // Wait for mutation to resolve
    await act(async () => {
      await mutationPromise;
    });

    // Check that real data replaced optimistic data
    const finalData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(finalData).toHaveLength(3);
    expect(finalData?.[2]).toBe(newItem);

    // Check that pending updates were cleared
    expect(result.current.pendingUpdates).toHaveLength(0);
  });

  it('should rollback optimistic update on mutation failure', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOptimisticUpdates(defaultOptions), { wrapper });

    const newItem: TestItem = { id: '3', name: 'Item 3', value: 30 };
    const mockError = new Error('Mutation failed');
    const mockMutation = jest.fn().mockRejectedValue(mockError);

    let mutationPromise: Promise<TestItem>;
    
    act(() => {
      mutationPromise = result.current.addOptimisticUpdate(newItem, mockMutation);
    });

    // Check that optimistic update was applied
    const optimisticData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(optimisticData).toHaveLength(3);

    // Wait for mutation to fail
    await act(async () => {
      try {
        await mutationPromise;
      } catch (error) {
        // Expected to fail
      }
    });

    // Check that data was rolled back
    const rolledBackData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(rolledBackData).toHaveLength(2);
    expect(rolledBackData).toEqual(mockItems);

    // Check that pending updates were cleared
    expect(result.current.pendingUpdates).toHaveLength(0);
  });

  it('should handle timeout and rollback', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOptimisticUpdates(defaultOptions), { wrapper });

    const newItem: TestItem = { id: '3', name: 'Item 3', value: 30 };
    // Mock mutation that never resolves
    const mockMutation = jest.fn().mockImplementation(() => new Promise(() => {}));

    act(() => {
      result.current.addOptimisticUpdate(newItem, mockMutation, { timeout: 5000 });
    });

    // Check that optimistic update was applied
    const optimisticData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(optimisticData).toHaveLength(3);

    // Fast-forward past timeout
    act(() => {
      jest.advanceTimersByTime(5100);
    });

    // Check that data was rolled back due to timeout
    await waitFor(() => {
      const rolledBackData = queryClient.getQueryData<TestItem[]>(queryKey);
      expect(rolledBackData).toHaveLength(2);
      expect(rolledBackData).toEqual(mockItems);
    });

    // Check that pending updates were cleared
    expect(result.current.pendingUpdates).toHaveLength(0);
  });

  it('should update existing item optimistically', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOptimisticUpdates(defaultOptions), { wrapper });

    const updates = { name: 'Updated Item 1', value: 100 };
    const updatedItem: TestItem = { id: '1', name: 'Updated Item 1', value: 100 };
    const mockMutation = jest.fn().mockResolvedValue(updatedItem);

    let mutationPromise: Promise<TestItem>;
    
    act(() => {
      mutationPromise = result.current.updateOptimisticItem('1', updates, mockMutation);
    });

    // Check that optimistic update was applied
    const optimisticData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(optimisticData?.[0].name).toBe('Updated Item 1');
    expect(optimisticData?.[0].value).toBe(100);

    // Wait for mutation to resolve
    await act(async () => {
      await mutationPromise;
    });

    // Check that real data replaced optimistic data
    const finalData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(finalData?.[0]).toBe(updatedItem);
  });

  it('should remove item optimistically', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOptimisticUpdates(defaultOptions), { wrapper });

    const mockMutation = jest.fn().mockResolvedValue(undefined);

    let mutationPromise: Promise<void>;
    
    act(() => {
      mutationPromise = result.current.removeOptimisticItem('1', mockMutation);
    });

    // Check that item was removed optimistically
    const optimisticData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(optimisticData).toHaveLength(1);
    expect(optimisticData?.[0].id).toBe('2');

    // Wait for mutation to resolve
    await act(async () => {
      await mutationPromise;
    });

    // Check that item is still removed
    const finalData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(finalData).toHaveLength(1);
    expect(finalData?.[0].id).toBe('2');
  });

  it('should rollback item removal on failure', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOptimisticUpdates(defaultOptions), { wrapper });

    const mockError = new Error('Removal failed');
    const mockMutation = jest.fn().mockRejectedValue(mockError);

    let mutationPromise: Promise<void>;
    
    act(() => {
      mutationPromise = result.current.removeOptimisticItem('1', mockMutation);
    });

    // Check that item was removed optimistically
    const optimisticData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(optimisticData).toHaveLength(1);

    // Wait for mutation to fail
    await act(async () => {
      try {
        await mutationPromise;
      } catch (error) {
        // Expected to fail
      }
    });

    // Check that item was restored
    const rolledBackData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(rolledBackData).toHaveLength(2);
    expect(rolledBackData).toEqual(mockItems);
  });

  it('should clear all pending updates', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOptimisticUpdates(defaultOptions), { wrapper });

    const newItem1: TestItem = { id: '3', name: 'Item 3', value: 30 };
    const newItem2: TestItem = { id: '4', name: 'Item 4', value: 40 };
    
    // Mock mutations that never resolve
    const mockMutation1 = jest.fn().mockImplementation(() => new Promise(() => {}));
    const mockMutation2 = jest.fn().mockImplementation(() => new Promise(() => {}));

    act(() => {
      result.current.addOptimisticUpdate(newItem1, mockMutation1);
      result.current.addOptimisticUpdate(newItem2, mockMutation2);
    });

    // Check that optimistic updates were applied
    const optimisticData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(optimisticData).toHaveLength(4);
    expect(result.current.pendingUpdates).toHaveLength(2);

    // Clear all pending updates
    act(() => {
      result.current.clearPendingUpdates();
    });

    // Check that data was rolled back and pending updates cleared
    const rolledBackData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(rolledBackData).toEqual(mockItems);
    expect(result.current.pendingUpdates).toHaveLength(0);
  });

  it('should handle multiple concurrent optimistic updates', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOptimisticUpdates(defaultOptions), { wrapper });

    const newItem1: TestItem = { id: '3', name: 'Item 3', value: 30 };
    const newItem2: TestItem = { id: '4', name: 'Item 4', value: 40 };
    
    const mockMutation1 = jest.fn().mockResolvedValue(newItem1);
    const mockMutation2 = jest.fn().mockResolvedValue(newItem2);

    let promise1: Promise<TestItem>;
    let promise2: Promise<TestItem>;
    
    act(() => {
      promise1 = result.current.addOptimisticUpdate(newItem1, mockMutation1);
      promise2 = result.current.addOptimisticUpdate(newItem2, mockMutation2);
    });

    // Check that both optimistic updates were applied
    const optimisticData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(optimisticData).toHaveLength(4);
    expect(result.current.pendingUpdates).toHaveLength(2);

    // Wait for both mutations to resolve
    await act(async () => {
      await Promise.all([promise1, promise2]);
    });

    // Check final state
    const finalData = queryClient.getQueryData<TestItem[]>(queryKey);
    expect(finalData).toHaveLength(4);
    expect(result.current.pendingUpdates).toHaveLength(0);
  });
});