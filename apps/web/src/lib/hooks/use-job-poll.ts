"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseJobPollOptions {
  jobId: string | null;
  enabled?: boolean;
  intervalMs?: number;
  onComplete?: (result: Record<string, unknown>) => void;
  onFailed?: (error: string) => void;
}

interface UseJobPollResult {
  status: "pending" | "running" | "completed" | "failed" | null;
  result: Record<string, unknown> | null;
  error: string | null;
  isPolling: boolean;
}

export function useJobPoll({
  jobId,
  enabled = true,
  intervalMs = 2000,
  onComplete,
  onFailed,
}: UseJobPollOptions): UseJobPollResult {
  const [status, setStatus] = useState<UseJobPollResult["status"]>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);

  onCompleteRef.current = onComplete;
  onFailedRef.current = onFailed;

  const poll = useCallback(async () => {
    if (!jobId) return;

    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const json = await res.json();
      const job = json.job;

      if (!job) return;

      setStatus(job.status);

      if (job.status === "completed") {
        setResult(job.result || {});
        setIsPolling(false);
        onCompleteRef.current?.(job.result || {});
      } else if (job.status === "failed") {
        setError(job.error || "Job failed");
        setIsPolling(false);
        onFailedRef.current?.(job.error || "Job failed");
      }
    } catch {
      // Silently retry on network errors
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !enabled) {
      setIsPolling(false);
      return;
    }

    setStatus("pending");
    setResult(null);
    setError(null);
    setIsPolling(true);

    // Initial poll
    poll();

    const interval = setInterval(() => {
      poll();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [jobId, enabled, intervalMs, poll]);

  // Stop interval once polling is done
  useEffect(() => {
    if (!isPolling && status && (status === "completed" || status === "failed")) {
      // Polling already stopped
    }
  }, [isPolling, status]);

  return { status, result, error, isPolling };
}
