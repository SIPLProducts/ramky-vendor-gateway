import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { usePushNotifications } from './usePushNotifications';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

interface VendorUpdate {
  id: string;
  status: string;
  legal_name: string | null;
  trade_name: string | null;
  updated_at: string;
}

interface RealtimeHookOptions {
  onVendorUpdate?: (vendor: VendorUpdate) => void;
  onValidationUpdate?: (validation: any) => void;
  showNotifications?: boolean;
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  validation_pending: 'Validation in Progress',
  validation_failed: 'Validation Failed',
  finance_review: 'Pending Finance Review',
  finance_approved: 'Finance Approved',
  finance_rejected: 'Finance Rejected',
  purchase_review: 'Pending Purchase Approval',
  purchase_approved: 'Fully Approved',
  purchase_rejected: 'Purchase Rejected',
  sap_synced: 'Synced to SAP',
};

export function useRealtimeUpdates(options: RealtimeHookOptions = {}) {
  const { user } = useAuth();
  const { sendLocalNotification, isSubscribed: notificationsEnabled } = usePushNotifications();
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { onVendorUpdate, onValidationUpdate, showNotifications = true } = options;

  const handleVendorChange = useCallback((payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'UPDATE' && newRecord) {
      const vendor: VendorUpdate = {
        id: newRecord.id,
        status: newRecord.status,
        legal_name: newRecord.legal_name,
        trade_name: newRecord.trade_name,
        updated_at: newRecord.updated_at,
      };

      setLastUpdate(new Date());
      onVendorUpdate?.(vendor);

      // Check if status changed
      if (oldRecord && oldRecord.status !== newRecord.status && showNotifications) {
        const vendorName = newRecord.trade_name || newRecord.legal_name || 'Vendor';
        const statusLabel = statusLabels[newRecord.status] || newRecord.status;
        
        // Show in-app toast
        toast.info(`${vendorName}: ${statusLabel}`, {
          description: 'Vendor status has been updated',
          duration: 5000,
        });

        // Send push notification if enabled
        if (notificationsEnabled) {
          sendLocalNotification('Vendor Status Update', {
            body: `${vendorName} status changed to: ${statusLabel}`,
            tag: `vendor-update-${newRecord.id}`,
          });
        }
      }
    }

    if (eventType === 'INSERT' && newRecord && showNotifications) {
      const vendorName = newRecord.trade_name || newRecord.legal_name || 'New Vendor';
      toast.success(`New vendor registered: ${vendorName}`, {
        duration: 5000,
      });
    }
  }, [onVendorUpdate, showNotifications, notificationsEnabled, sendLocalNotification]);

  const handleValidationChange = useCallback((payload: any) => {
    const { eventType, new: newRecord } = payload;
    
    if ((eventType === 'INSERT' || eventType === 'UPDATE') && newRecord) {
      setLastUpdate(new Date());
      onValidationUpdate?.(newRecord);

      if (showNotifications && newRecord.status) {
        const validationType = newRecord.validation_type?.toUpperCase() || 'Validation';
        const statusMessage = newRecord.status === 'passed' 
          ? `${validationType} verification passed`
          : newRecord.status === 'failed'
          ? `${validationType} verification failed`
          : `${validationType} verification pending`;

        if (newRecord.status === 'passed') {
          toast.success(statusMessage, { duration: 4000 });
        } else if (newRecord.status === 'failed') {
          toast.error(statusMessage, { duration: 4000 });
        }
      }
    }
  }, [onValidationUpdate, showNotifications]);

  useEffect(() => {
    if (!user) return;

    // Create realtime channel for vendors
    const channel = supabase
      .channel('realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendors',
        },
        handleVendorChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_validations',
        },
        handleValidationChange
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('Realtime channel connected');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, handleVendorChange, handleValidationChange]);

  const reconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      // Re-trigger the effect by forcing a re-render
      setIsConnected(false);
    }
  }, []);

  return {
    isConnected,
    lastUpdate,
    reconnect,
  };
}

// Hook for monitoring connection status
export function useConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'slow' | 'offline'>('good');

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionQuality('good');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionQuality('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check connection quality periodically
    const checkConnection = async () => {
      if (!navigator.onLine) {
        setConnectionQuality('offline');
        return;
      }

      try {
        const start = Date.now();
        await fetch('/ramky-logo.png', { cache: 'no-cache', method: 'HEAD' });
        const latency = Date.now() - start;
        setConnectionQuality(latency > 2000 ? 'slow' : 'good');
      } catch {
        setConnectionQuality('slow');
      }
    };

    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    checkConnection(); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return { isOnline, connectionQuality };
}
