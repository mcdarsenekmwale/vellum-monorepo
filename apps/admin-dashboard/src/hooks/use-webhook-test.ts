// hooks/useWebhookTest.ts

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { toast } from 'sonner';

export interface WebhookTestConfig {
  event: string;
  data: any;
  platform?: 'teams' | 'slack' | 'discord' | 'generic' | 'custom';
  config?: {
    cardType?: 'message' | 'adaptive';
    channel?: string;
    headers?: Record<string, string>;
    includeSignature?: boolean;
    includeTimestamp?: boolean;
  };
}

export interface WebhookTestResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  responseBody?: any;
  responseHeaders?: Record<string, string>;
  errorMessage?: string;
  platform?: string;
  requestId: string;
  timestamp: string;
}

export function useWebhookTest() {
  const [result, setResult] = useState<WebhookTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      webhookId,
      config,
    }: {
      webhookId: string;
      config: WebhookTestConfig;
    }) => {
      setIsLoading(true);
      setResult(null);

      const response = await api(`/webhooks/${webhookId}/test`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
      return response as any;
    },
    onSuccess: (response: WebhookTestResult) => {
      setResult(response);
      if (response.success) {
        toast.success(`Webhook test successful (${response.statusCode})`);
      } else {
        toast.error(`Webhook test failed: ${response.errorMessage || 'Unknown error'}`);
      }
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || 'Test failed';
      setResult({
        success: false,
        errorMessage,
        responseTime: 0,
        timestamp: new Date().toISOString(),
        requestId: 'error',
      });
      toast.error(`Webhook test failed: ${errorMessage}`);
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const runTest = useCallback(
    (webhookId: string, config: WebhookTestConfig) => {
      return mutation.mutateAsync({ webhookId, config });
    },
    [mutation],
  );

  return {
    runTest,
    result,
    isLoading,
    isError: mutation.isError,
    error: mutation.error,
    reset: () => {
      setResult(null);
      setIsLoading(false);
      mutation.reset();
    },
  };
}
