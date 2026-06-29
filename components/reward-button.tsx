'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Coins, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-config';

interface RewardButtonProps {
  taskId: string;
  initialTxHash?: string | null;
}

type State = 'idle' | 'loading' | 'success' | 'error';

export function RewardButton({ taskId, initialTxHash }: RewardButtonProps) {
  const [state, setState] = useState<State>(initialTxHash ? 'success' : 'idle');
  const [txHash, setTxHash] = useState<string | null>(initialTxHash || null);
  const [error, setError] = useState<string | null>(null);

  async function handleReward() {
    setState('loading');
    setError(null);
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({ error: 'Invalid JSON response' }));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setTxHash(data.txHash);
      setState('success');
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
      setState('error');
    }
  }

  if (state === 'success' && txHash) {
    return (
      <Badge className="border-green-500/30 bg-green-500/10 text-green-400" variant="outline">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Rewarded
        <span className="ml-1 font-mono text-[10px] opacity-70">
          {txHash.slice(0, 6)}...{txHash.slice(-4)}
        </span>
      </Badge>
    );
  }

  if (state === 'error') {
    return (
      <Button size="sm" variant="destructive" onClick={handleReward} title={error || 'Error'}>
        Retry
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={handleReward}
      disabled={state === 'loading'}
      className="bg-amber-500 text-black hover:bg-amber-400"
    >
      {state === 'loading' ? (
        <>
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Minting...
        </>
      ) : (
        <>
          <Coins className="mr-1 h-3 w-3" />
          Reward WPT
        </>
      )}
    </Button>
  );
}