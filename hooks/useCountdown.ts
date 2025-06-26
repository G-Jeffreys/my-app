import { useState, useEffect } from 'react';

// Console log function for debugging TTL behavior
const logTTL = (message: string, data?: any) => {
  console.log(`[TTL-Debug] ${message}`, data ? data : '');
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

  useEffect(() => {
    logTTL('🔄 useCountdown effect triggered', { 
      receivedAt: receivedAt?.toISOString(), 
      ttlPreset,
      hasReceivedAt: !!receivedAt 
    });

    if (!receivedAt) {
      logTTL('⏸️ No receivedAt timestamp, countdown paused');
      return;
    }

    const ttlSeconds = ttlToSeconds(ttlPreset);
    if (ttlSeconds === 0) {
      logTTL('⚠️ Invalid TTL, setting as expired immediately');
      setIsExpired(true);
      return;
    }

    const expiresAt = receivedAt.getTime() + ttlSeconds * 1000;
    
    logTTL('⏰ Starting countdown', {
      receivedAt: receivedAt.toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      ttlSeconds,
      ttlPreset
    });

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = expiresAt - now;

      if (distance < 0) {
        logTTL('⏱️ Message expired!', { 
          messageId: 'current-message',
          expiredBy: Math.abs(distance / 1000) + ' seconds'
        });
        clearInterval(interval);
        setRemaining(0);
        setIsExpired(true);
      } else {
        const secondsRemaining = Math.ceil(distance / 1000);
        setRemaining(secondsRemaining);
        
        // Log every 30 seconds and final 10 seconds for debugging
        if (secondsRemaining % 30 === 0 || secondsRemaining <= 10) {
          logTTL(`⏳ ${secondsRemaining}s remaining`);
        }
      }
    }, 1000);

    return () => {
      logTTL('🧹 Countdown cleanup');
      clearInterval(interval);
    };
  }, [receivedAt, ttlPreset]);

  return { remaining, isExpired };
}; 