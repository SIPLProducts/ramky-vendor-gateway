import { useState, useEffect, useCallback } from 'react';

interface CacheConfig {
  key: string;
  ttl?: number; // Time to live in milliseconds
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function useOfflineCache<T>(config: CacheConfig) {
  const { key, ttl = DEFAULT_TTL } = config;
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cachedData, setCachedData] = useState<T | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cached data on mount
  useEffect(() => {
    const cached = getFromCache(key);
    if (cached) {
      setCachedData(cached.data);
      setLastUpdated(new Date(cached.timestamp));
    }
  }, [key]);

  const saveToCache = useCallback((data: T) => {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    try {
      localStorage.setItem(`offline_cache_${key}`, JSON.stringify(entry));
      setCachedData(data);
      setLastUpdated(new Date());
      return true;
    } catch (error) {
      console.error('Error saving to cache:', error);
      // If localStorage is full, try to clear old entries
      clearExpiredCache();
      return false;
    }
  }, [key, ttl]);

  const getFromCache = (cacheKey: string): CacheEntry<T> | null => {
    try {
      const stored = localStorage.getItem(`offline_cache_${cacheKey}`);
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);
      
      // Check if entry is expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        localStorage.removeItem(`offline_cache_${cacheKey}`);
        return null;
      }

      return entry;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  };

  const clearCache = useCallback(() => {
    localStorage.removeItem(`offline_cache_${key}`);
    setCachedData(null);
    setLastUpdated(null);
  }, [key]);

  const clearExpiredCache = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('offline_cache_'));
    keys.forEach(k => {
      try {
        const stored = localStorage.getItem(k);
        if (stored) {
          const entry = JSON.parse(stored);
          if (Date.now() - entry.timestamp > entry.ttl) {
            localStorage.removeItem(k);
          }
        }
      } catch {
        localStorage.removeItem(k);
      }
    });
  };

  const getCacheAge = useCallback(() => {
    if (!lastUpdated) return null;
    const diff = Date.now() - lastUpdated.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  }, [lastUpdated]);

  return {
    isOnline,
    cachedData,
    lastUpdated,
    saveToCache,
    clearCache,
    getCacheAge,
  };
}

// Hook for caching vendor data specifically
export function useVendorOfflineCache() {
  const vendorCache = useOfflineCache<any[]>({ 
    key: 'vendors_list',
    ttl: 12 * 60 * 60 * 1000 // 12 hours
  });
  
  const statsCache = useOfflineCache<any>({ 
    key: 'vendor_stats',
    ttl: 6 * 60 * 60 * 1000 // 6 hours
  });

  return {
    vendors: vendorCache,
    stats: statsCache,
    isOnline: vendorCache.isOnline,
  };
}
