import { useState, useEffect, useRef, useMemo } from 'react';

// Throttled logging to prevent performance issues
const logCache = new Map<string, number>();
const LOG_THROTTLE_MS = 5000; // Only log same message once per 5 seconds for TTL

const logTTL = (message: string, data?: any) => {
  const key = `${message}${data ? JSON.stringify(data) : ''}`;
  const now = Date.now();
  const lastLog = logCache.get(key) || 0;
  
  if (now - lastLog > LOG_THROTTLE_MS) {
    console.log(`[TTL-Debug] ${message}`, data ? data : '');
    logCache.set(key, now);
  }
};

const ttlToSeconds = (ttl: string): number => {
  const unit = ttl.slice(-1);
  const value = parseInt(ttl.slice(0, -1), 10);

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    default:
      logTTL('⚠️ Invalid TTL format, defaulting to 0', ttl);
      return 0;
  }
};

// Updated to use receivedAt timestamp for client-side TTL countdown
export const useCountdown = (receivedAt: Date | null, ttlPreset: string) => {
  const [remaining, setRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const expiresAtRef = useRef<number | null>(null);
  
  // Memoize the expiration time calculation to prevent unnecessary recalculations
  const expiresAt = useMemo(() => {
    if (!receivedAt) return null;
    const ttlSeconds = ttlToSeconds(ttlPreset);
    if (ttlSeconds === 0) return null;
    return receivedAt.getTime() + ttlSeconds * 1000;
  }, [receivedAt, ttlPreset]);

  useEffect(() => {
    // Throttle the effect trigger logs to prevent spam
    logTTL('🔄 useCountdown effect triggered', { 
      receivedAt: receivedAt?.toISOString(), 
      ttlPreset,
      hasReceivedAt: !!receivedAt,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
    });

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!receivedAt || !expiresAt) {
      logTTL('⏸️ No receivedAt timestamp or invalid TTL, countdown paused');
      setRemaining(0);
      setIsExpired(false);
      return;
    }

    expiresAtRef.current = expiresAt;
    
    logTTL('⏰ Starting countdown', {
      receivedAt: receivedAt.toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      ttlSeconds: ttlToSeconds(ttlPreset),
      ttlPreset
    });

    // Calculate initial remaining time
    const now = new Date().getTime();
    const initialDistance = expiresAt - now;
    
    if (initialDistance <= 0) {
      logTTL('⏱️ Message already expired!', { 
        expiredBy: Math.abs(initialDistance / 1000) + ' seconds'
      });
      setRemaining(0);
      setIsExpired(true);
      return;
    }

    // Set initial remaining time
    const initialSecondsRemaining = Math.ceil(initialDistance / 1000);
    setRemaining(initialSecondsRemaining);
    setIsExpired(false);

    // Start countdown interval
    intervalRef.current = window.setInterval(() => {
      const currentTime = new Date().getTime();
      const distance = expiresAtRef.current! - currentTime;

      if (distance <= 0) {
        logTTL('⏱️ Message expired!', { 
          messageId: 'current-message',
          expiredBy: Math.abs(distance / 1000) + ' seconds'
        });
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        setRemaining(0);
        setIsExpired(true);
      } else {
        const secondsRemaining = Math.ceil(distance / 1000);
        setRemaining(secondsRemaining);
        
        // Only log critical countdown milestones to reduce spam
        if (secondsRemaining % 60 === 0 || secondsRemaining === 10 || secondsRemaining === 5) {
          logTTL(`⏳ ${secondsRemaining}s remaining`);
        }
      }
    }, 1000);

    return () => {
      logTTL('🧹 Countdown cleanup');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [expiresAt, receivedAt, ttlPreset]); // Use memoized expiresAt as dependency

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return { remaining, isExpired };
}; 