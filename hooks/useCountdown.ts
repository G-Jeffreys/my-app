import { useState, useEffect } from 'react';

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
      return 0;
  }
};

export const useCountdown = (receivedAt: Date | null, ttlPreset: string) => {
  const [remaining, setRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!receivedAt) return;

    const ttlSeconds = ttlToSeconds(ttlPreset);
    const expiresAt = receivedAt.getTime() + ttlSeconds * 1000;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = expiresAt - now;

      if (distance < 0) {
        clearInterval(interval);
        setRemaining(0);
        setIsExpired(true);
      } else {
        setRemaining(Math.ceil(distance / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [receivedAt, ttlPreset]);

  return { remaining, isExpired };
}; 