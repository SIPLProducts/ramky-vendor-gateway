import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConnectionStatus } from '@/hooks/useRealtimeUpdates';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  showLabel?: boolean;
  className?: string;
}

export function ConnectionStatus({ showLabel = false, className }: ConnectionStatusProps) {
  const { isOnline, connectionQuality } = useConnectionStatus();
  const { isConnected: realtimeConnected, lastUpdate, reconnect } = useRealtimeUpdates();

  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: 'Offline',
        description: 'No internet connection. Showing cached data.',
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
      };
    }

    if (connectionQuality === 'slow') {
      return {
        icon: Wifi,
        label: 'Slow Connection',
        description: 'Connection is slow. Some features may be delayed.',
        color: 'text-warning',
        bgColor: 'bg-warning/10',
      };
    }

    if (!realtimeConnected) {
      return {
        icon: CloudOff,
        label: 'Reconnecting',
        description: 'Reconnecting to live updates...',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
      };
    }

    return {
      icon: Cloud,
      label: 'Live',
      description: lastUpdate 
        ? `Last update: ${formatTimeAgo(lastUpdate)}`
        : 'Connected to live updates',
      color: 'text-success',
      bgColor: 'bg-success/10',
    };
  };

  const status = getStatusInfo();
  const Icon = status.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-full transition-colors cursor-default',
            status.bgColor,
            className
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', status.color)} />
          {showLabel && (
            <span className={cn('text-xs font-medium', status.color)}>
              {status.label}
            </span>
          )}
          {!realtimeConnected && isOnline && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={reconnect}
            >
              <RefreshCw className="h-3 w-3 animate-spin" />
            </Button>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-sm font-medium">{status.label}</p>
        <p className="text-xs text-muted-foreground">{status.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}
