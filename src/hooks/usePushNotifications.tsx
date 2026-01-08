import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'default';
  loading: boolean;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
    loading: true,
  });

  useEffect(() => {
    // Check if push notifications are supported
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'default',
      loading: false,
    }));

    // Check existing subscription
    if (isSupported && Notification.permission === 'granted') {
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState(prev => ({ ...prev, isSubscribed: !!subscription }));
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      toast.error('Push notifications are not supported on this device');
      return false;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission, loading: false }));

      if (permission === 'granted') {
        toast.success('Notifications enabled!');
        return true;
      } else if (permission === 'denied') {
        toast.error('Notification permission denied');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      setState(prev => ({ ...prev, loading: false }));
      toast.error('Failed to request notification permission');
      return false;
    }
  }, [state.isSupported]);

  const subscribe = useCallback(async () => {
    if (!state.isSupported || state.permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Create a subscription (using a placeholder VAPID key for demo)
      // In production, you'd get this from your server
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
        ),
      });

      // Store subscription in database if user is logged in
      if (user?.id) {
        // You could store this in a push_subscriptions table
        console.log('Push subscription created for user:', user.id);
      }

      setState(prev => ({ ...prev, isSubscribed: true, loading: false }));
      toast.success('Push notifications enabled!');
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      setState(prev => ({ ...prev, loading: false }));
      toast.error('Failed to enable push notifications');
      return false;
    }
  }, [state.isSupported, state.permission, user?.id, requestPermission]);

  const unsubscribe = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }

      setState(prev => ({ ...prev, isSubscribed: false, loading: false }));
      toast.success('Push notifications disabled');
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      setState(prev => ({ ...prev, loading: false }));
      toast.error('Failed to disable push notifications');
      return false;
    }
  }, []);

  // Send a local notification (for testing/demo purposes)
  const sendLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!state.isSupported || state.permission !== 'granted') {
      toast.error('Notifications not enabled');
      return;
    }

    try {
      new Notification(title, {
        icon: '/ramky-logo.png',
        badge: '/ramky-logo.png',
        ...options,
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, [state.isSupported, state.permission]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    sendLocalNotification,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}
