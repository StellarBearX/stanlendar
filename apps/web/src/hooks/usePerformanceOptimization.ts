'use client';

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';

// Debounced callback hook
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const debouncedCallback = useMemo(() => {
    const debounced = (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    };
    
    (debounced as any).cancel = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
    
    return debounced;
  }, [callback, delay, ...deps]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback as T;
}

// Throttled callback hook
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const throttledCallback = useMemo(() => {
    const throttled = (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;
      
      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    };
    
    (throttled as any).cancel = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
    
    return throttled;
  }, [callback, delay, ...deps]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback as T;
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const elementRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const observe = useCallback((callback: (entry: IntersectionObserverEntry) => void) => {
    if (!elementRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(callback);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );

    observerRef.current.observe(elementRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [options]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return { elementRef, observe };
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const mountTime = useRef(Date.now());
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    const now = Date.now();
    const timeSinceMount = now - mountTime.current;
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development') {
      if (renderCount.current === 1) {
        console.log(`${componentName}: Initial render`);
      } else if (renderCount.current % 5 === 0) {
        console.log(`${componentName}: ${renderCount.current} renders in ${timeSinceMount}ms`);
      }

      // Warn about frequent re-renders
      if (timeSinceLastRender < 16 && renderCount.current > 5) {
        console.warn(`${componentName}: Frequent re-renders detected (${timeSinceLastRender}ms)`);
      }
    }
  });

  const getMetrics = useCallback(() => ({
    renderCount: renderCount.current,
    timeSinceMount: Date.now() - mountTime.current,
    averageRenderTime: (Date.now() - mountTime.current) / renderCount.current
  }), []);

  return { getMetrics };
}

// Memory usage monitoring
export function useMemoryMonitor() {
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }, []);

  const logMemoryUsage = useCallback((label: string) => {
    const usage = checkMemoryUsage();
    if (usage && process.env.NODE_ENV === 'development') {
      console.log(`Memory usage (${label}):`, {
        used: `${(usage.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(usage.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(usage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        percentage: `${usage.usagePercentage.toFixed(2)}%`
      });
    }
  }, [checkMemoryUsage]);

  return { checkMemoryUsage, logMemoryUsage };
}

// Optimized state updates
export function useBatchedUpdates<T>(
  initialState: T,
  batchDelay: number = 16
): [T, (updater: (prev: T) => T) => void] {
  const [state, setState] = useState(initialState);
  const pendingUpdates = useRef<Array<(prev: T) => T>>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const batchedSetState = useCallback((updater: (prev: T) => T) => {
    pendingUpdates.current.push(updater);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setState(prevState => {
        let newState = prevState;
        pendingUpdates.current.forEach(update => {
          newState = update(newState);
        });
        pendingUpdates.current = [];
        return newState;
      });
    }, batchDelay);
  }, [batchDelay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, batchedSetState];
}

// Image lazy loading hook
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const { elementRef, observe } = useIntersectionObserver();

  useEffect(() => {
    const cleanup = observe((entry) => {
      if (entry.isIntersecting && !isLoaded && !isError) {
        const img = new Image();
        img.onload = () => {
          setImageSrc(src);
          setIsLoaded(true);
        };
        img.onerror = () => {
          setIsError(true);
        };
        img.src = src;
      }
    });

    return cleanup;
  }, [src, isLoaded, isError, observe]);

  return {
    elementRef,
    imageSrc,
    isLoaded,
    isError
  };
}

// Component lazy loading with error boundary
export function useLazyComponent<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) {
  const [Component, setComponent] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = useCallback(async () => {
    if (Component || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const module = await importFunc();
      setComponent(() => module.default);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [Component, isLoading, importFunc]);

  return {
    Component,
    isLoading,
    error,
    loadComponent
  };
}

// Optimized list rendering
export function useOptimizedList<T>(
  items: T[],
  keyExtractor: (item: T, index: number) => string,
  itemsPerPage: number = 50
) {
  const [currentPage, setCurrentPage] = useState(1);
  
  const visibleItems = useMemo(() => {
    const startIndex = 0;
    const endIndex = currentPage * itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  const hasMore = useMemo(() => {
    return currentPage * itemsPerPage < items.length;
  }, [currentPage, itemsPerPage, items.length]);

  const loadMore = useCallback(() => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasMore]);

  const reset = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Generate stable keys for React rendering
  const itemsWithKeys = useMemo(() => {
    return visibleItems.map((item, index) => ({
      key: keyExtractor(item, index),
      item,
      index
    }));
  }, [visibleItems, keyExtractor]);

  return {
    visibleItems: itemsWithKeys,
    hasMore,
    loadMore,
    reset,
    currentPage,
    totalPages: Math.ceil(items.length / itemsPerPage)
  };
}

// Performance-optimized search
export function useOptimizedSearch<T>(
  items: T[],
  searchFields: (keyof T)[],
  searchTerm: string,
  debounceMs: number = 300
) {
  const [filteredItems, setFilteredItems] = useState<T[]>(items);
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = useCallback((term: string) => {
    if (!term.trim()) {
      setFilteredItems(items);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    // Use requestIdleCallback for non-blocking search
    const searchCallback = (deadline: IdleDeadline) => {
      const results: T[] = [];
      const lowerTerm = term.toLowerCase();
      
      for (let i = 0; i < items.length; i++) {
        if (deadline.timeRemaining() <= 0) {
          // Continue in next idle period
          requestIdleCallback(searchCallback);
          return;
        }

        const item = items[i];
        const matches = searchFields.some(field => {
          const value = item[field];
          return String(value).toLowerCase().includes(lowerTerm);
        });

        if (matches) {
          results.push(item);
        }
      }

      setFilteredItems(results);
      setIsSearching(false);
    };

    requestIdleCallback(searchCallback);
  }, [items, searchFields]);

  const debouncedSearch = useDebounce(performSearch, debounceMs, [performSearch]);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  return {
    filteredItems,
    isSearching
  };
}