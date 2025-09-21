'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

interface VirtualScrollListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  loadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

export function VirtualScrollList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  loadMore,
  hasMore = false,
  loading = false
}: VirtualScrollListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggered = useRef(false);

  const totalHeight = items.length * itemHeight;

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length - 1, end + overscan)
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      result.push({
        index: i,
        item: items[i],
        offsetY: i * itemHeight
      });
    }
    return result;
  }, [items, visibleRange, itemHeight]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);

    // Infinite scroll logic
    if (loadMore && hasMore && !loading && !loadMoreTriggered.current) {
      const scrollHeight = e.currentTarget.scrollHeight;
      const clientHeight = e.currentTarget.clientHeight;
      const threshold = scrollHeight - clientHeight - 100; // 100px before end

      if (newScrollTop >= threshold) {
        loadMoreTriggered.current = true;
        loadMore();
      }
    }
  };

  // Reset load more trigger when loading completes
  useEffect(() => {
    if (!loading) {
      loadMoreTriggered.current = false;
    }
  }, [loading]);

  // Scroll to top when items change significantly
  useEffect(() => {
    if (scrollElementRef.current && items.length === 0) {
      scrollElementRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ index, item, offsetY }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: offsetY,
              left: 0,
              right: 0,
              height: itemHeight
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
        
        {loading && (
          <div
            style={{
              position: 'absolute',
              top: totalHeight,
              left: 0,
              right: 0,
              height: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">Loading more...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for managing virtual scroll state
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length]);

  const scrollToIndex = (index: number) => {
    const targetScrollTop = index * itemHeight;
    setScrollTop(targetScrollTop);
  };

  const scrollToTop = () => {
    setScrollTop(0);
  };

  return {
    scrollTop,
    setScrollTop,
    visibleRange,
    scrollToIndex,
    scrollToTop,
    totalHeight: items.length * itemHeight
  };
}

// Memoized list item component for better performance
export const MemoizedListItem = React.memo(function MemoizedListItem<T>({
  item,
  index,
  renderItem
}: {
  item: T;
  index: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  return <>{renderItem(item, index)}</>;
});

// Example usage component for events
interface EventListItemProps {
  event: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    room?: string;
    subject: {
      name: string;
      colorHex: string;
    };
  };
  index: number;
}

export const EventListItem = React.memo(function EventListItem({
  event,
  index
}: EventListItemProps) {
  return (
    <div className="flex items-center p-3 border-b border-gray-200 hover:bg-gray-50">
      <div
        className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
        style={{ backgroundColor: event.subject.colorHex }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">
          {event.title}
        </div>
        <div className="text-sm text-gray-500">
          {event.startTime} - {event.endTime}
          {event.room && ` • ${event.room}`}
        </div>
      </div>
      <div className="text-xs text-gray-400 ml-2">
        #{index + 1}
      </div>
    </div>
  );
});

// Performance monitoring hook
export function useVirtualScrollPerformance() {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development' && renderCount.current % 10 === 0) {
      console.log(`VirtualScroll: ${renderCount.current} renders, ${timeSinceLastRender}ms since last`);
    }
  });

  return {
    renderCount: renderCount.current,
    resetMetrics: () => {
      renderCount.current = 0;
      lastRenderTime.current = Date.now();
    }
  };
}