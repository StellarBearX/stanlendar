'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, Clock } from 'lucide-react';
import { useToast } from './Toast';

interface OfflineIndicatorProps {
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = '',
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        addToast({
          type: 'success',
          title: 'Back Online',
          message: 'Connection restored. Syncing pending changes...',
          duration: 3000,
        });
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      addToast({
        type: 'warning',
        title: 'Connection Lost',
        message: 'You are offline. Changes will be saved when connection is restored.',
        duration: 0, // Don't auto-dismiss
      });
    };

    // Set initial state
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast, wasOffline]);

  if (isOnline) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 z-50 ${className}`}>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-3 flex items-center space-x-2 max-w-sm">
        <WifiOff className="h-5 w-5 text-yellow-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-yellow-800">
            You're offline
          </p>
          <p className="text-xs text-yellow-700">
            Changes will sync when connection returns
          </p>
        </div>
        <div className="flex-shrink-0">
          <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
        </div>
      </div>
    </div>
  );
};

// Hook to check online status
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// Component to show connection status in header/navbar
export const ConnectionStatus: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const isOnline = useOnlineStatus();

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-600 hidden sm:inline">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-xs text-red-600 hidden sm:inline">Offline</span>
        </>
      )}
    </div>
  );
};