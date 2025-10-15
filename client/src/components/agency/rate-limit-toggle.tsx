import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

async function fetchRateLimitStatus() {
  const res = await fetch('/api/settings/rate-limit-status');
  if (!res.ok) {
    throw new Error('Network response was not ok');
  }
  return res.json();
}

async function toggleRateLimit() {
  const res = await fetch('/api/settings/toggle-rate-limit', {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('You may not have permission to perform this action.');
  }
  return res.json();
}

export function RateLimitToggle() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rateLimitStatus'],
    queryFn: fetchRateLimitStatus,
  });

  const mutation = useMutation({
    mutationFn: toggleRateLimit,
    onSuccess: (newData) => {
      queryClient.setQueryData(['rateLimitStatus'], { isEnabled: newData.isEnabled });
      toast({
        title: 'Success',
        description: `API rate limiter is now ${newData.isEnabled ? 'ON' : 'OFF'}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle rate limiter.',
        variant: 'destructive',
      });
    },
  });
  
  if (isError) {
    return null;
  }

  return (
    <Card data-testid="card-rate-limit-toggle">
      <CardHeader>
        <CardTitle>Developer Settings</CardTitle>
        <CardDescription>
          These settings are for development and debugging purposes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center space-x-2">
             <Skeleton className="h-6 w-24" />
             <Skeleton className="h-6 w-12" />
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Switch
              id="rate-limit-switch"
              checked={data?.isEnabled}
              onCheckedChange={() => mutation.mutate()}
              disabled={mutation.isPending}
              data-testid="switch-rate-limit"
            />
            <Label htmlFor="rate-limit-switch">
              API Rate Limiter ({data?.isEnabled ? 'ON' : 'OFF'})
            </Label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
