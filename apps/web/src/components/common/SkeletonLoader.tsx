import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width = 'w-full',
  height = 'h-4',
}) => {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${width} ${height} ${className}`}
    />
  );
};

export const CalendarSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <Skeleton width="w-32" height="h-8" />
        <div className="flex space-x-2">
          <Skeleton width="w-20" height="h-8" />
          <Skeleton width="w-20" height="h-8" />
          <Skeleton width="w-20" height="h-8" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`header-${i}`} width="w-full" height="h-8" />
        ))}
        
        {/* Calendar days */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={`day-${i}`} className="aspect-square p-1">
            <Skeleton width="w-full" height="h-full" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const EventListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton width="w-24" height="h-5" />
            <Skeleton width="w-16" height="h-4" />
          </div>
          <Skeleton width="w-3/4" height="h-4" />
          <div className="flex space-x-4">
            <Skeleton width="w-20" height="h-4" />
            <Skeleton width="w-16" height="h-4" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const SubjectCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-3">
            <Skeleton width="w-12" height="h-12" className="rounded-full" />
            <div className="space-y-1 flex-1">
              <Skeleton width="w-3/4" height="h-5" />
              <Skeleton width="w-1/2" height="h-4" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton width="w-full" height="h-4" />
            <Skeleton width="w-2/3" height="h-4" />
          </div>
          <div className="flex justify-between">
            <Skeleton width="w-16" height="h-6" />
            <Skeleton width="w-20" height="h-6" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ImportPreviewSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton width="w-48" height="h-6" />
        <Skeleton width="w-24" height="h-8" />
      </div>

      {/* Table header */}
      <div className="grid grid-cols-6 gap-4 p-4 border-b">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={`th-${i}`} width="w-full" height="h-5" />
        ))}
      </div>

      {/* Table rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={`row-${i}`} className="grid grid-cols-6 gap-4 p-4 border-b">
          {Array.from({ length: 6 }).map((_, j) => (
            <Skeleton key={`cell-${i}-${j}`} width="w-full" height="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const FormSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Form fields */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton width="w-24" height="h-5" />
          <Skeleton width="w-full" height="h-10" />
        </div>
      ))}

      {/* Buttons */}
      <div className="flex space-x-3">
        <Skeleton width="w-24" height="h-10" />
        <Skeleton width="w-20" height="h-10" />
      </div>
    </div>
  );
};