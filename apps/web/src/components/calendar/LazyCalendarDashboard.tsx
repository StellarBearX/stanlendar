'use client';

import React, { Suspense, lazy } from 'react';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { SkeletonLoader } from '../common/SkeletonLoader';

// Lazy load heavy calendar components
const FullCalendar = lazy(() => import('@fullcalendar/react'));
const SpotlightFilter = lazy(() => import('../spotlight/SpotlightFilter'));
const SyncControls = lazy(() => import('./SyncControls'));

interface LazyCalendarDashboardProps {
  events: any[];
  onEventClick?: (event: any) => void;
  onDateSelect?: (date: Date) => void;
}

export function LazyCalendarDashboard({
  events,
  onEventClick,
  onDateSelect
}: LazyCalendarDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Spotlight Filter - Load first as it's most interactive */}
      <Suspense fallback={<SpotlightFilterSkeleton />}>
        <SpotlightFilter />
      </Suspense>

      {/* Sync Controls - Load second */}
      <Suspense fallback={<SyncControlsSkeleton />}>
        <SyncControls />
      </Suspense>

      {/* Calendar - Load last as it's heaviest */}
      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarComponent 
          events={events}
          onEventClick={onEventClick}
          onDateSelect={onDateSelect}
        />
      </Suspense>
    </div>
  );
}

// Optimized calendar component with memoization
const CalendarComponent = React.memo(function CalendarComponent({
  events,
  onEventClick,
  onDateSelect
}: {
  events: any[];
  onEventClick?: (event: any) => void;
  onDateSelect?: (date: Date) => void;
}) {
  const calendarOptions = React.useMemo(() => ({
    plugins: ['dayGrid', 'timeGrid', 'interaction'],
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    initialView: 'dayGridMonth',
    events: events,
    eventClick: onEventClick,
    dateClick: onDateSelect,
    height: 'auto',
    eventDisplay: 'block',
    dayMaxEvents: 3,
    moreLinkClick: 'popover',
    eventTimeFormat: {
      hour: 'numeric',
      minute: '2-digit',
      meridiem: 'short'
    }
  }), [events, onEventClick, onDateSelect]);

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <FullCalendar {...calendarOptions} />
    </div>
  );
});

// Skeleton components for loading states
function SpotlightFilterSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <SkeletonLoader className="h-10 w-full mb-4" />
      <div className="flex gap-2">
        <SkeletonLoader className="h-8 w-20" />
        <SkeletonLoader className="h-8 w-24" />
        <SkeletonLoader className="h-8 w-16" />
      </div>
    </div>
  );
}

function SyncControlsSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="flex justify-between items-center">
        <SkeletonLoader className="h-6 w-32" />
        <div className="flex gap-2">
          <SkeletonLoader className="h-9 w-24" />
          <SkeletonLoader className="h-9 w-20" />
        </div>
      </div>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-2">
          <SkeletonLoader className="h-8 w-16" />
          <SkeletonLoader className="h-8 w-16" />
          <SkeletonLoader className="h-8 w-16" />
        </div>
        <SkeletonLoader className="h-8 w-32" />
        <div className="flex gap-2">
          <SkeletonLoader className="h-8 w-20" />
          <SkeletonLoader className="h-8 w-16" />
          <SkeletonLoader className="h-8 w-12" />
        </div>
      </div>
      
      {/* Calendar grid skeleton */}
      <div className="grid grid-cols-7 gap-1">
        {/* Header row */}
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonLoader key={`header-${i}`} className="h-8 w-full" />
        ))}
        
        {/* Calendar days */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={`day-${i}`} className="aspect-square border border-gray-100 p-1">
            <SkeletonLoader className="h-4 w-6 mb-1" />
            {Math.random() > 0.7 && (
              <SkeletonLoader className="h-3 w-full mb-1" />
            )}
            {Math.random() > 0.8 && (
              <SkeletonLoader className="h-3 w-3/4" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Hook for progressive loading
export function useProgressiveLoading() {
  const [loadedComponents, setLoadedComponents] = React.useState<Set<string>>(new Set());
  
  const markAsLoaded = React.useCallback((componentName: string) => {
    setLoadedComponents(prev => new Set([...prev, componentName]));
  }, []);
  
  const isLoaded = React.useCallback((componentName: string) => {
    return loadedComponents.has(componentName);
  }, [loadedComponents]);
  
  return { markAsLoaded, isLoaded, loadedCount: loadedComponents.size };
}

// Performance monitoring component
export function CalendarPerformanceMonitor({ children }: { children: React.ReactNode }) {
  const [renderMetrics, setRenderMetrics] = React.useState({
    renderCount: 0,
    lastRenderTime: Date.now(),
    averageRenderTime: 0
  });

  React.useEffect(() => {
    const now = Date.now();
    const timeSinceLastRender = now - renderMetrics.lastRenderTime;
    
    setRenderMetrics(prev => ({
      renderCount: prev.renderCount + 1,
      lastRenderTime: now,
      averageRenderTime: (prev.averageRenderTime * prev.renderCount + timeSinceLastRender) / (prev.renderCount + 1)
    }));

    // Log performance in development
    if (process.env.NODE_ENV === 'development' && renderMetrics.renderCount > 0) {
      console.log('Calendar Performance:', {
        renders: renderMetrics.renderCount,
        avgRenderTime: Math.round(renderMetrics.averageRenderTime),
        lastRenderTime: timeSinceLastRender
      });
    }
  });

  return <>{children}</>;
}